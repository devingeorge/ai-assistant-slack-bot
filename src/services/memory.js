// src/services/memory.js
import Redis from 'ioredis';
import { config } from '../config.js';

// Create Redis client with error handling
let redis;
try {
  redis = new Redis(config.redis.url, {
    connectTimeout: 5000,
    lazyConnect: true,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });
  
  redis.on('error', (err) => {
    console.warn('Redis connection error:', err.message);
  });
  
  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });
} catch (err) {
  console.warn('Redis initialization failed:', err.message);
  // Create a mock redis client for development
  redis = {
    setex: () => Promise.resolve(),
    get: () => Promise.resolve(null),
    del: () => Promise.resolve(),
    keys: () => Promise.resolve([]),
    rpush: () => Promise.resolve(),
    ltrim: () => Promise.resolve(),
    expire: () => Promise.resolve(),
    lrange: () => Promise.resolve([]),
    quit: () => Promise.resolve(),
  };
}

export { redis };

const TTL_SECS = config.redis.memoryTtlDays * 24 * 3600;

/** -------- Conversation memory (per DM/thread) -------- **/
export const convoKey = ({ team, channel, thread, user }) =>
  `convo:${team}:${channel}:${thread || 'dm'}:${user}`;

export async function appendMessage(key, msg) {
  await redis.rpush(key, JSON.stringify(msg));
  await redis.ltrim(key, -200, -1);
  await redis.expire(key, TTL_SECS);
}

export async function loadHistory(key, limit = config.redis.memoryTurns) {
  const raw = await redis.lrange(key, -limit, -1);
  return raw.map((s) => JSON.parse(s));
}

export async function clearUserMemory(team, user) {
  const pattern = `convo:${team}:*:*:${user}`;
  const stream = redis.scanStream({ match: pattern });
  const keys = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (resultKeys) => { keys.push(...resultKeys); });
    stream.on('end', async () => {
      if (keys.length) await redis.del(...keys);
      resolve(keys.length);
    });
    stream.on('error', reject);
  });
}

/** -------- Assistant thread root per IM channel -------- **/
const assistantThreadKey = (channelId) => `assistant_thread:${channelId}`;

export async function setAssistantThread(channelId, threadTs) {
  // TTL configurable via config.assistant.threadTtlSeconds
  await redis.setex(assistantThreadKey(channelId), config.assistant.threadTtlSeconds, threadTs);
}

export async function getAssistantThread(channelId) {
  return redis.get(assistantThreadKey(channelId));
}

export async function deleteAssistantThread(channelId) {
  if (!channelId) return 0;
  return redis.del(assistantThreadKey(channelId));
}

/** -------- Assistant context per user (what they’re viewing) -------- **/
const assistantCtxKey = (userId) => `assistant_ctx:${userId}`;

export async function setAssistantContextForUser(userId, ctx) {
  // TTL configurable via config.assistant.contextTtlSeconds
  await redis.setex(assistantCtxKey(userId), config.assistant.contextTtlSeconds, JSON.stringify(ctx));
}

export async function getAssistantContextForUser(userId) {
  const raw = await redis.get(assistantCtxKey(userId));
  return raw ? JSON.parse(raw) : null;
}

export async function clearAssistantContextForUser(userId) {
  await redis.del(assistantCtxKey(userId));
}

/** -------- One-call helper to clear all cached state for a user -------- **/
export async function clearAllUserState(team, user) {
  const removedConvos = await clearUserMemory(team, user);
  await clearAssistantContextForUser(user);
  return { removedConvos };
}

/** -------- Bulk clear helpers (used on shutdown) -------- **/
export async function clearAllState() {
  const patterns = ['convo:*', 'assistant_thread:*', 'assistant_ctx:*'];
  for (const pattern of patterns) {
    const stream = redis.scanStream({ match: pattern });
    const keys = [];
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      stream.on('data', (resultKeys) => { keys.push(...resultKeys); });
      stream.on('end', async () => {
        if (keys.length) await redis.del(...keys);
        resolve();
      });
      stream.on('error', reject);
    });
  }
}
