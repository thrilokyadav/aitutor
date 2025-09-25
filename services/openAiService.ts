import { ChatMessage, MessageSender, ChatModel } from '../types';

interface OpenAiChoice {
    delta: {
        content: string | null;
    };
    finish_reason: string | null;
}

interface OpenAiStreamChunk {
    choices: OpenAiChoice[];
}

// Helper to convert our ChatMessage format to OpenAI's format
const buildOpenAiMessages = (messages: ChatMessage[], systemInstruction: string, lastUserMessage?: string) => {
    const history = messages.map(msg => ({
        role: msg.sender === MessageSender.USER ? 'user' as const : 'assistant' as const,
        content: msg.text
    }));
    
    // For OpenAI, the last user message for the current turn is part of the main `messages` array
    if (lastUserMessage) {
        history.push({ role: 'user', content: lastUserMessage });
    }
    
    return [
        { role: 'system' as const, content: systemInstruction },
        ...history
    ];
};


class OpenAiService {
    private apiKey: string;
    private apiUrl = 'https://api.openai.com/v1/chat/completions';

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("OpenAI API key is not provided");
        }
        this.apiKey = apiKey;
    }

    async *sendMessageStream(model: ChatModel, history: ChatMessage[], systemInstruction: string, userMessage?: string): AsyncGenerator<string, void, unknown> {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: buildOpenAiMessages(history, systemInstruction, userMessage),
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("OpenAI API Error:", errorData);
            throw new Error(`OpenAI API request failed: ${errorData.error?.message || response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Could not get reader from response body");
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data === '[DONE]') {
                        return;
                    }
                    try {
                        const parsed: OpenAiStreamChunk = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch (e) {
                        console.error("Error parsing stream data:", e);
                    }
                }
            }
        }
    }
}

export default OpenAiService;