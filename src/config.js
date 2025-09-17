// src/config.js
import 'dotenv/config';

export const config = {
  slack: {
    // For single-tenant mode (backwards compatibility)
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    
    // For multi-tenant OAuth mode
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    stateSecret: process.env.SLACK_STATE_SECRET || (() => {
      console.warn('⚠️  SLACK_STATE_SECRET not set, generating a random one. This may cause OAuth issues in production!');
      return 'fallback-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    })(),
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    temperature: Number(process.env.MODEL_TEMPERATURE || 0.3)
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    memoryTurns: Number(process.env.MEMORY_TURNS || 16),
    memoryTtlDays: Number(process.env.MEMORY_TTL_DAYS || 14)
  },
  assistant: {
    threadTtlSeconds: Number(process.env.ASSISTANT_THREAD_TTL_SECONDS || 24 * 3600),
    contextTtlSeconds: Number(process.env.ASSISTANT_CONTEXT_TTL_SECONDS || 30 * 60)
  },
  rag: {
    enabled: process.env.RAG_ENABLED === 'true',
    pgConn: process.env.PG_CONN,
    topK: Number(process.env.RAG_TOP_K || 5)
  },
  features: {
    channelContext: process.env.FEAT_CHANNEL_CONTEXT !== 'false', // default ON
    recentMessages: process.env.FEAT_RECENT_MESSAGES !== 'false', // default ON
    rag: process.env.RAG_ENABLED === 'true',
    dataAccess: process.env.FEAT_DATA_ACCESS === 'true'          // default OFF
  },
  limits: {
    maxUserChars: Number(process.env.MAX_USER_CHARS || 4000)
  }
};
