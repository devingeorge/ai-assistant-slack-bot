// src/services/channels.js
import { slackCall } from '../lib/slackRetry.js';

/**
 * conversations.info — fetch channel metadata (name, topic, purpose, privacy).
 * Returns: { channel, error }
 * Scopes: channels:read (public) and/or groups:read (private)
 */
export async function fetchChannelInfo(client, channelId) {
  try {
    const res = await slackCall(client.conversations.info, { channel: channelId });
    return { channel: res?.channel || null, error: null };
  } catch (e) {
    const err = e?.data?.error || e?.message || 'unknown_error';
    return { channel: null, error: err };
  }
}

/**
 * conversations.history — fetch recent messages for grounding.
 * Returns: { messages, error }
 * Scopes: channels:history (public), groups:history (private)
 * Note: bot must be a member to read private channels (and often enterprise public channels).
 */
export async function fetchRecentMessages(client, channelId, limit = 10) {
  try {
    const res = await slackCall(client.conversations.history, { channel: channelId, limit });
    return { messages: res?.messages || [], error: null };
  } catch (e) {
    const err = e?.data?.error || e?.message || 'unknown_error';
    return { messages: [], error: err };
  }
}

/**
 * conversations.join — attempt to join a public channel so we can read it.
 * Returns: { ok, error }
 * Scope: channels:join
 */
export async function tryJoinPublicChannel(client, channelId) {
  try {
    const res = await slackCall(client.conversations.join, { channel: channelId });
    return { ok: res?.ok === true, error: null };
  } catch (e) {
    const err = e?.data?.error || e?.message || 'unknown_error';
    return { ok: false, error: err };
  }
}
