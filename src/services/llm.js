// src/services/llm.js
// Simple selector so you can flip providers by env without touching handlers.
import { geminiStream } from './llmGemini.js';
import { grokStream } from './llmGrok.js';

export function getLLMStream() {
  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) return grokStream;
  if (process.env.GEMINI_API_KEY) return geminiStream;
  throw new Error('No LLM provider configured (set GROK_API_KEY/XAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY)');
}
