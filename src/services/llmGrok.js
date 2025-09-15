// src/services/llmGrok.js
// Streaming helper for xAI Grok via OpenAI-compatible API

import OpenAI from 'openai';

const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
const baseURL = process.env.XAI_BASE_URL || 'https://api.x.ai/v1';

// Only create client if we have an API key
let client = null;
if (apiKey) {
  client = new OpenAI({ apiKey, baseURL });
}

export async function* grokStream({ messages, system }) {
  if (!client) {
    throw new Error('Grok API key not configured. Please set GROK_API_KEY or XAI_API_KEY environment variable.');
  }

  const model = process.env.GROK_MODEL || 'grok-2-latest';
  const temperature = Number(process.env.MODEL_TEMPERATURE || 0.3);

  const MAX_INPUT_CHARS = 12000;
  const coerceText = (val) => {
    const s = typeof val === 'string' ? val : JSON.stringify(val ?? '');
    return s.replace(/\s+/g, ' ').slice(0, MAX_INPUT_CHARS);
  };

  const chatMessages = [];
  if (system) chatMessages.push({ role: 'system', content: coerceText(system) });
  for (const m of Array.isArray(messages) ? messages : []) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = coerceText(m?.content || '');
    if (content) chatMessages.push({ role, content });
  }

  try {
    const stream = await client.chat.completions.create({
      model,
      temperature,
      messages: chatMessages,
      stream: true
    });

    for await (const part of stream) {
      try {
        const delta = part?.choices?.[0]?.delta?.content || '';
        if (delta) yield delta;
      } catch {}
    }
  } catch (e) {
    try {
      const resp = await client.chat.completions.create({
        model,
        temperature,
        messages: chatMessages,
        stream: false
      });
      const text = resp?.choices?.[0]?.message?.content || '';
      if (text) yield text;
    } catch (e2) {
      const msg = e2?.message || e?.message || 'Model error';
      yield `Sorry — the Grok model request failed. (${msg})`;
    }
  }
}


