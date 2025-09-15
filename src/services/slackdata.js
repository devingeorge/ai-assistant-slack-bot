// src/services/slackData.js
import { slackCall } from '../lib/slackRetry.js';
import { redis } from './memory.js';

// --- tiny cache helpers (Redis, 60-120s default) ---
async function cacheGet(key) {
  const v = await redis.get(key);
  return v ? JSON.parse(v) : null;
}
async function cacheSet(key, val, ttlSec = 90) {
  await redis.setex(key, ttlSec, JSON.stringify(val));
}

// --- Readers with caching & graceful errors ---

export async function getChannelInfo(client, channelId) {
  const ck = `sld:info:${channelId}`;
  const cached = await cacheGet(ck);
  if (cached) return cached;

  try {
    const res = await slackCall(client.conversations.info, { channel: channelId });
    const data = { ok: true, channel: res.channel };
    await cacheSet(ck, data, 90);
    return data;
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error' };
  }
}

export async function getRecentMessages(client, channelId, { limit = 20, oldest, latest } = {}) {
  // Use a short cache window to avoid hammering Slack if people ask multiple times
  const keyParts = [channelId, limit, oldest || '0', latest || 'now'].join(':');
  const ck = `sld:hist:${keyParts}`;
  const cached = await cacheGet(ck);
  if (cached) return cached;

  try {
    const res = await slackCall(client.conversations.history, {
      channel: channelId,
      limit,
      oldest,
      latest,
      inclusive: false
    });
    const data = { ok: true, messages: res.messages || [] };
    await cacheSet(ck, data, 60);
    return data;
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error', messages: [] };
  }
}

export async function tryJoin(client, channelId) {
  try {
    const res = await slackCall(client.conversations.join, { channel: channelId });
    return { ok: res?.ok === true, error: null };
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error' };
  }
}

// Optional readers you’ll probably want soon:
export async function getReplies(client, channelId, thread_ts, { limit = 30 } = {}) {
  try {
    const res = await slackCall(client.conversations.replies, { channel: channelId, ts: thread_ts, limit });
    return { ok: true, messages: res.messages || [] };
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error', messages: [] };
  }
}

export async function getUser(client, userId) {
  const ck = `sld:user:${userId}`;
  const cached = await cacheGet(ck);
  if (cached) return cached;

  try {
    const res = await slackCall(client.users.info, { user: userId });
    const data = { ok: true, user: res.user };
    await cacheSet(ck, data, 300);
    return data;
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error' };
  }
}
