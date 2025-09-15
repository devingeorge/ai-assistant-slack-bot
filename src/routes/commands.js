// src/routes/commands.js
import { config } from '../config.js';
import { convoKey } from '../services/memory.js';
import { store } from '../services/store.js';
import { retrieveContext, initRagIfNeeded } from '../services/rag.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { slackCall } from '../lib/slackRetry.js';
import { getLLMStream } from '../services/llm.js';

/** Small stream helper for slash commands. */
async function streamToSlack({ client, channel, thread_ts, iter, initialText = 'Thinking…' }) {
  let ts = null;
  let buf = '';
  let last = 0;

  const posted = await slackCall(client.chat.postMessage, {
    channel,
    thread_ts,
    text: initialText
  });
  ts = posted.ts;

  for await (const chunk of iter) {
    buf += chunk;
    const now = Date.now();
    if (now - last > 700) {
      await slackCall(client.chat.update, { channel, ts, text: buf.slice(0, 3900) });
      last = now;
    }
  }

  if (ts) {
    await slackCall(client.chat.update, { channel, ts, text: buf.slice(0, 3900) });
  }
}

export function registerCommands(app) {
  /**
   * /ask — quick Q&A in the current channel/thread (Gemini only).
   */
  app.command('/ask', async ({ ack, command, client, context }) => {
    await ack();

    try {
      const team = context.teamId || command.team_id;
      const channel = command.channel_id;
      const user = command.user_id;
      const prompt = String(command.text || '').slice(0, config.limits?.maxUserChars ?? 4000);

      const thread_ts = command.thread_ts || undefined; // stream to thread if invoked there
      const key = convoKey({ team, channel, thread: thread_ts || null, user });

      await store.addUserTurn(key, prompt);

      const useRag = (config.features?.rag ?? config.rag?.enabled) === true;
      await initRagIfNeeded();
      const docContext = useRag ? await retrieveContext(prompt) : '';

      // Optional channel-aware context for slash command
      let channelContextText = null;
      if (config.features?.channelContext !== false) {
        try {
          const { getChannelInfo, getRecentMessages, tryJoin } = await import('../services/slackdata.js');
          let info = await getChannelInfo(client, channel);
          if (!info.ok && info.error === 'not_in_channel') {
            const joined = await tryJoin(client, channel);
            if (joined.ok) info = await getChannelInfo(client, channel);
          }

          if (info.ok && info.channel) {
            const c = info.channel;
            const cname = c.is_private ? `(private) ${c.name}` : `#${c.name}`;
            const topic = c.topic?.value ? `Topic: ${c.topic.value}` : '';
            const purpose = c.purpose?.value ? `Purpose: ${c.purpose.value}` : '';
            channelContextText = `Current channel: ${cname}\n${topic}\n${purpose}`.trim();

            if (config.features?.recentMessages === true) {
              const hist = await getRecentMessages(client, channel, { limit: 12 });
              if (hist.ok && hist.messages.length) {
                const summarized = hist.messages
                  .filter((m) => m.type === 'message' && m.text)
                  .map((m) => `- ${m.user || 'someone'}: ${m.text}`)
                  .join('\n');
                if (summarized) {
                  channelContextText += `\n\nRecent messages (most recent first):\n${summarized}`;
                }
              }
            }
          } else if (!info.ok) {
            channelContextText = `Limited channel access (${channel}): ${info.error}`;
          }
        } catch {}
      }

      const system = buildSystemPrompt({
        surface: 'channel',
        channelContextText,
        docContext
      });

      const history = await store.history(key);
      const llmStream = getLLMStream();
      const iter = llmStream({ messages: history, system });

      await streamToSlack({
        client,
        channel,
        thread_ts,
        iter,
        initialText: 'Thinking…'
      });
    } catch (err) {
      try {
        await slackCall(client.chat.postEphemeral, {
          channel: command.channel_id,
          user: command.user_id,
          text: `Sorry — I couldn’t process /ask. (${err?.data?.error || err?.message || 'unknown error'})`
        });
      } catch {}
    }
  });
}
