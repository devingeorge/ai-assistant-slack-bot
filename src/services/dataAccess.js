// src/services/dataAccess.js
// Thin wrapper around Slack's Data Access API (assistant.search.context)
// Requires: assistant_thread action_token from events and appropriate search:read.* scopes.

import { config } from '../config.js';
import { slackCall } from '../lib/slackRetry.js';

/**
 * Call Slack Data Access API to search for contextual messages/files.
 * Returns { ok, results, error }
 */
export async function assistantSearchContext(client, { query, action_token, channel_id, channel_types, content_types, limit = 10, include_bots = false, cursor }) {
  if (!config.features?.dataAccess) {
    return { ok: false, error: 'feature_disabled' };
  }
  if (!action_token) {
    return { ok: false, error: 'missing_action_token' };
  }

  try {
    const res = await slackCall(client.assistant.search.context, {
      query,
      action_token,
      token: client.token,
      context_channel_id: channel_id,
      channel_types,
      content_types,
      include_bots: include_bots ? true : undefined,
      limit,
      cursor
    });
    return { ok: true, results: res?.results || {}, response_metadata: res?.response_metadata };
  } catch (e) {
    return { ok: false, error: e?.data?.error || e?.message || 'unknown_error' };
  }
}

export function formatResultsAsBullets(results) {
  if (!results) return '';
  const messages = results.messages || [];
  if (!messages.length) return '';
  const items = messages.slice(0, 10).map((m) => {
    const author = m.is_author_bot ? 'bot' : (m.author_user_id || 'someone');
    const snippet = (m.content || '').slice(0, 400).replace(/\s+/g, ' ').trim();
    const link = m.permalink ? ` — ${m.permalink}` : '';
    return `- ${author}: ${snippet}${link}`;
  });
  return items.join('\n');
}


