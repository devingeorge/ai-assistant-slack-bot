// src/services/llm.js
// Simple selector so you can flip providers by env without touching handlers.
import { geminiStream } from './llmGemini.js';
import { grokStream } from './llmGrok.js';

export function getLLMStream() {
  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY) return grokStream;
  if (process.env.GEMINI_API_KEY) return geminiStream;
  
  // Return a placeholder function that explains the issue
  return async function* placeholderStream({ messages, system }) {
    yield 'Hello! I need an AI provider API key to work properly. Please set one of:\n';
    yield '• GROK_API_KEY (for xAI Grok)\n';
    yield '• XAI_API_KEY (for xAI Grok)\n'; 
    yield '• GEMINI_API_KEY (for Google Gemini)\n';
    yield '\nOnce configured, I\'ll be able to provide intelligent responses!';
  };
}
