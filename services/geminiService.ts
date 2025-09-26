import { GoogleGenAI, Chat, Type, GenerateContentResponse, GroundingChunk as GenAIGroundingChunk, Content } from "@google/genai";
import { PlannerTask, QuizQuestion, GroundingChunk, QuizDifficulty, ChatMessage, MessageSender, CurrentAffairsQuery, TopicExplainerConfig } from '../types';

const BEAUTIFUL_OUTPUT_INSTRUCTION = "VERY IMPORTANT: Your output MUST be well-structured and easy to read. Use Markdown for formatting: headings (#, ##), bold (**text**), italics (*text*), lists (- item), and tables where appropriate (using pipes | for columns). **Crucially, ensure there is a blank line between paragraphs for better readability.** Use emojis to make the content engaging (e.g., 📚 for topics, 💡 for key ideas, ✅ for completed tasks). Do not include any HTML tags. Your tone should be that of an expert, encouraging tutor.";

const ALL_GOV_TUTOR_INSTRUCTION = `You are an expert tutor for ALL GOV examinations. Your responses must be accurate, detailed, and structured for easy learning. Maintain a formal and encouraging tone. When explaining concepts, break them down into simple parts. ${BEAUTIFUL_OUTPUT_INSTRUCTION}`;

const GLOBAL_ASSISTANT_INSTRUCTION = `You are a helpful AI assistant for a user studying for ALL GOV exams. The user will provide you with their current context (what they are looking at in the app). Use this context to provide relevant and concise help. Be friendly and supportive. ${BEAUTIFUL_OUTPUT_INSTRUCTION}`;

// Helper to convert our ChatMessage format to Gemini's Content format
const buildHistory = (messages: ChatMessage[]): Content[] => {
  return messages.map(message => ({
    role: message.sender === MessageSender.USER ? 'user' : 'model',
    parts: [{ text: message.text }]
  }));
};

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Prefer Vite client-side env var; fall back to Node env for SSR/testing
    const apiKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY)
      ?? (typeof process !== 'undefined' ? process.env.API_KEY : undefined);

    if (!apiKey) {
      // Provide a clear developer-facing error to avoid opaque 400s from the API
      throw new Error("Gemini API key not found. Please set VITE_GEMINI_API_KEY in your Vite environment (e.g., .env.local) or set process.env.API_KEY.");
    }

    this.ai = new GoogleGenAI({ apiKey });
  }

  private createChat(systemInstruction: string, history: ChatMessage[]): Chat {
      return this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: systemInstruction,
        },
        history: buildHistory(history),
      });
  }

  getGeneralTutorChat(history: ChatMessage[]): Chat {
    return this.createChat(ALL_GOV_TUTOR_INSTRUCTION, history);
  }

  getSubjectChat(subject: string, history: ChatMessage[], lang: 'en' | 'kn' = 'en'): Chat {
    const instruction = `You are an expert tutor for ALL GOV examinations, specializing in the subject of ${subject}. Your responses must be accurate, detailed, and structured for easy learning. Use clear headings, bullet points, and provide examples where relevant. Maintain a formal and encouraging tone. When explaining concepts, break them down into simple parts. Focus strictly on ${subject}. ${BEAUTIFUL_OUTPUT_INSTRUCTION}`;
    const langSuffix = lang === 'kn' ? '\nIMPORTANT: Respond in Kannada (kn-IN) language.' : '';
    return this.createChat(instruction + langSuffix, history);
  }
  
  getGlobalAssistantChat(history: ChatMessage[], lang: 'en' | 'kn' = 'en'): Chat {
    const langSuffix = lang === 'kn' ? '\nIMPORTANT: Respond in Kannada (kn-IN) language.' : '';
    return this.createChat(GLOBAL_ASSISTANT_INSTRUCTION + langSuffix, history);
  }

  async explainTopic(topic: string, config: TopicExplainerConfig, lang: 'en' | 'kn' = 'en'): Promise<string> {
    const prompt = `
      Provide a detailed explanation of the following topic for an ALL GOV aspirant: "${topic}".
      Tailor the explanation with the following parameters:
      - Depth/Level: ${config.depth}
      - Desired Format: ${config.format}
      ${config.focus ? `- Specific Focus: ${config.focus}` : ''}
      
      Structure the explanation with an introduction, key aspects, significance, and a conclusion.
    `;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: ALL_GOV_TUTOR_INSTRUCTION + (lang === 'kn' ? '\nIMPORTANT: Respond in Kannada (kn-IN) language.' : '')
      }
    });
    return response.text;
  }
  
  private async _generateQuiz(prompt: string, systemInstruction?: string): Promise<QuizQuestion[]> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING, description: "A brief explanation of the correct answer in Markdown format." }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"],
          },
        },
      },
    });
    
    try {
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        if (Array.isArray(parsedData) && parsedData.every(q => 'question' in q && 'options' in q && 'correctAnswerIndex' in q)) {
            return parsedData as QuizQuestion[];
        } else {
            console.warn("Generated quiz data is not in the expected format.", parsedData);
            throw new Error("Generated quiz data is not in the expected format.");
        }
    } catch (error) {
        console.error("Failed to parse quiz JSON:", error);
        throw new Error("Could not generate a valid quiz. The AI response was malformed.");
    }
  }

  async generateQuiz(topic: string, numQuestions: number, difficulty: QuizDifficulty, lang: 'en' | 'kn' = 'en'): Promise<QuizQuestion[]> {
    const prompt = `Generate a ${numQuestions}-question multiple-choice quiz on the ALL GOV topic: "${topic}". The difficulty level should be ${difficulty}. For each question, provide 4 options, the index of the correct answer, and a brief explanation for the correct answer in Markdown format.`;
    const sys = ALL_GOV_TUTOR_INSTRUCTION + (lang === 'kn' ? '\nIMPORTANT: Write all questions, options, and explanations in Kannada (kn-IN).' : '');
    return this._generateQuiz(prompt, sys);
  }

  async generateSubjectQuiz(subject: string, numQuestions: number, difficulty: QuizDifficulty, lang: 'en' | 'kn' = 'en'): Promise<QuizQuestion[]> {
    const prompt = `Generate a ${numQuestions}-question multiple-choice quiz on the ALL GOV subject: "${subject}". The difficulty level should be ${difficulty}. The questions should cover a wide range of topics within the subject. For each question, provide 4 options, the index of the correct answer, and a brief explanation for the correct answer in Markdown format.`;
    const sys = ALL_GOV_TUTOR_INSTRUCTION + (lang === 'kn' ? '\nIMPORTANT: Write all questions, options, and explanations in Kannada (kn-IN).' : '');
    return this._generateQuiz(prompt, sys);
  }
  
  async getCurrentAffairs(query: CurrentAffairsQuery, lang: 'en' | 'kn' = 'en'): Promise<{ summary: string; sources: GroundingChunk[] }> {
    const prompt = `
            Provide a comprehensive summary of current affairs relevant to ALL GOV examinations based on the following criteria:
            - Date: ${query.date}
            - Region: ${query.region}
            ${query.keywords ? `- Keywords: ${query.keywords}` : ''}
            
            Structure the summary with clear headings for different topics (e.g., Polity, Economy, International Relations) using Markdown.
            The summary should be objective, factual, and tailored for a competitive exam aspirant.
            Conclude with at least 5 key takeaways or bullet points.
        `;
    
    const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: `You are an expert ALL GOV current affairs summarizer. ${BEAUTIFUL_OUTPUT_INSTRUCTION}` + (lang === 'kn' ? '\nIMPORTANT: Respond in Kannada (kn-IN) language.' : ''),
            tools: [{ googleSearch: {} }],
        },
    });

    const summary = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources: GroundingChunk[] = groundingChunks
        .filter((chunk): chunk is GenAIGroundingChunk & { web: { uri: string; title: string } } => 
            'web' in chunk && typeof chunk.web?.uri === 'string' && typeof chunk.web?.title === 'string'
        )
        .map(chunk => ({
            web: {
                uri: chunk.web.uri,
                title: chunk.web.title,
            }
        }));

    return { summary, sources };
  }

  async generateStudyPlan(prompt: string): Promise<Omit<PlannerTask, 'id' | 'completed'>[]> {
    const today = new Date().toISOString().split('T')[0];
    const fullPrompt = `
        Based on the user's request: "${prompt}", generate a structured study plan for an ALL GOV aspirant.
        Today's date is ${today}. All task dates MUST be in YYYY-MM-DD format, starting from today or a future date.
        For each task, provide:
        1. A concise 'title'.
        2. A specific 'date' in YYYY-MM-DD format.
        3. Detailed 'notes' in Markdown format, which should act as a mini-study guide for the task. The notes should be comprehensive enough for the user to study from. Include headings (#, ##), lists (-), and bolded (**key concepts**) in the notes.
    `;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: `You are an expert ALL GOV study planner. ${BEAUTIFUL_OUTPUT_INSTRUCTION}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A concise title for the study task." },
              date: { type: Type.STRING, description: `The date for the task in YYYY-MM-DD format. Must be today (${today}) or later.` },
              notes: { type: Type.STRING, description: "Detailed study notes for the task in Markdown format. Should be a comprehensive guide." }
            },
            required: ["title", "date", "notes"],
          },
        },
      },
    });

    try {
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        if (Array.isArray(parsedData) && parsedData.every(item => 'title' in item && 'date' in item && 'notes' in item)) {
          return parsedData;
        } else {
          console.error("Generated plan is not in the expected format.", parsedData);
          throw new Error("Generated plan data is not in the expected format.");
        }
    } catch (error) {
        console.error("Failed to parse study plan JSON:", error, response.text);
        throw new Error("Could not generate a valid study plan. The AI response was malformed.");
    }
  }
}

export default GeminiService;