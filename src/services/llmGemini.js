// src/services/llmGemini.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function* geminiStream({ messages, system }) {
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

  const MAX_INPUT_CHARS = 12000;
  const coerceText = (val) => {
    const s = typeof val === 'string' ? val : JSON.stringify(val ?? '');
    return s.replace(/\s+/g, ' ').slice(0, MAX_INPUT_CHARS);
  };

  const safeMessages = Array.isArray(messages) ? messages : [];
  const parts = [];
  if (system) parts.push({ text: coerceText(`System: ${system}`) });
  for (const m of safeMessages) {
    const role = m?.role || 'user';
    const content = coerceText(m?.content || '');
    if (content) parts.push({ text: `${role}: ${content}` });
  }

  try {
    const stream = await model.generateContentStream({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
    });

    for await (const chunk of stream.stream) {
      try {
        const text = chunk?.text?.();
        if (text) yield text;
      } catch {}
    }
  } catch (e) {
    try {
      const resp = await model.generateContent({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
      });
      const text = resp?.response?.text?.();
      if (text) yield text;
    } catch (e2) {
      const msg = e2?.message || e?.message || 'Model error';
      yield `Sorry — the model stream failed to parse. (${msg})`;
    }
  }
}
