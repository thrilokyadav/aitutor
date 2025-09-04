import { GroundingChunk, CurrentAffairsQuery } from '../types';

// This is a mock of what a Perplexity API response might look like.
// In a real scenario, you'd use their SDK or a defined API response structure.
interface PerplexityChoice {
    message: {
        content: string;
    };
}
interface PerplexityResponse {
    choices: PerplexityChoice[];
}

class PerplexityService {
    private apiKey: string;
    private apiUrl = 'https://api.perplexity.ai/chat/completions'; // Example URL

    constructor(apiKey: string) {
        if (!apiKey) {
            throw new Error("Perplexity API key not provided.");
        }
        this.apiKey = apiKey;
    }

    async getCurrentAffairs(query: CurrentAffairsQuery): Promise<{ summary: string; sources: GroundingChunk[] }> {
        const prompt = `
            Provide a comprehensive summary of current affairs relevant to ALL GOV examinations based on the following criteria:
            - Date: ${query.date}
            - Region: ${query.region}
            ${query.keywords ? `- Keywords: ${query.keywords}` : ''}
            
            Structure the summary with clear headings for different topics (e.g., Polity, Economy, International Relations).
            The summary should be objective, factual, and tailored for a competitive exam aspirant.
            Format the entire output using Markdown for clear structure (headings, lists, bold text).
            Ensure there is a blank line between paragraphs for better readability.
            Conclude with at least 5 key takeaways or bullet points.
            Do not include any introductory or concluding conversational text. Just provide the summary.
        `;

        // This fetch call simulates interacting with the Perplexity API
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: 'llama-3-sonar-large-32k-online', // A model that can access the internet
                messages: [
                    { role: 'system', content: 'You are an expert news analyst for ALL GOV exam aspirants.' },
                    { role: 'user', content: prompt },
                ],
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Perplexity API Error:", errorData);
            throw new Error(`Perplexity API request failed: ${errorData.error?.message || response.statusText}`);
        }
        
        const data: PerplexityResponse = await response.json();
        
        const summary = data.choices[0]?.message?.content || "No summary could be generated.";
        
        // Perplexity Online models often cite sources directly in the text.
        // A real implementation would parse these out. For now, we'll return an empty array.
        const sources: GroundingChunk[] = []; 

        return { summary, sources };
    }
}

export default PerplexityService;