// src/services/intent.js
// Very lightweight intent detection for conversational triggers.
// You can expand this over time or swap with an LLM-based classifier.

const summarizePatterns = [
  /\bsummary\b.*\bchannel\b/i,
  /\bsummarize\b.*\bchannel\b/i,
  /\bgive me (a|the)?\s*summary\b/i,
  /\btldr\b.*\bchannel\b/i,
  /\bwhat(?:'s| is) (?:going on|happening) (?:in|with) (?:this|the) channel\b/i,
  /\bcan you (?:help )?summarize (?:this|the) channel\b/i,
  /\bsummarize here\b/i,
];

export function detectIntent(text = '') {
  const t = String(text || '').trim();
  if (!t) return { type: 'none' };

  if (summarizePatterns.some((re) => re.test(t))) {
    return { type: 'summarize_channel' };
  }

  return { type: 'none' };
}
