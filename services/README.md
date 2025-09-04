# Services

This directory contains modules that abstract interactions with external APIs, primarily the AI models. This separation of concerns keeps the component logic clean and focused on the UI, while the services handle the complexities of API communication.

## geminiService.ts

Handles all communication with the Google Gemini API (`@google/genai`).
- Manages different chat modes (general tutor, subject-specific, global assistant) with tailored system instructions.
- Implements functions for specific tasks like topic explanation, quiz generation, and AI-powered study plan creation, often using Gemini's JSON mode for structured output.
- Includes logic for using Google Search grounding for up-to-date information (e.g., in Current Affairs).

## openAiService.ts

Handles communication with the OpenAI API (for GPT models).
- Implements a streaming chat completion function.
- Acts as an alternative model provider for the chat interfaces, giving users a choice of AI.

## perplexityService.ts

Handles communication with the Perplexity API.
- Used primarily for the Current Affairs feature, leveraging Perplexity's online models for news summaries.
- Acts as an alternative to Gemini's search grounding for fetching real-time information.

### API Key Management

All services are instantiated with API keys provided from the global `AppContext`, allowing users to "bring their own key". The services are designed to fail gracefully if a key is not provided.
