// src/routes/events.js
import { config } from '../config.js';
import {
  convoKey,
  setAssistantThread,
  getAssistantThread,
  setAssistantContextForUser,
  getAssistantContextForUser
} from '../services/memory.js';
import { store } from '../services/store.js';
import { retrieveContext, initRagIfNeeded } from '../services/rag.js';
import { getChannelInfo, getRecentMessages, tryJoin } from '../services/slackdata.js';
import { buildSystemPrompt } from '../services/prompt.js';
import { getAgentSettings } from '../services/agentSettings.js';
import { slackCall } from '../lib/slackRetry.js';
import { logger } from '../lib/logger.js';
import { stopBlocks, homeView } from '../ui/views.js';
import { formatResponseAsBlocks, formatSimpleTextAsBlocks } from '../services/blockKitFormatter.js';
import { getLLMStream } from '../services/llm.js';
import { assistantSearchContext, formatResultsAsBullets } from '../services/dataAccess.js';
import { detectIntent } from '../services/intent.js';
import { createJiraTicket, getJiraConfig, extractTicketFromContext } from '../services/jira.js';
import { findMatchingTrigger } from '../services/triggers.js';

/** Resolve the channel the user is viewing in the Assistant panel (if present). */
function resolveViewedChannelId(ctx) {
  if (!ctx) return null;
  return (
    ctx.channel_id ||
    ctx.channel?.id ||
    ctx.conversation_id ||
    ctx.conversation?.id ||
    ctx.active_channel_id ||
    ctx.active_conversation_id ||
    null
  );
}

/** Streaming helper. If initialText is null, first token creates the message (Assistant pane UX). */
async function streamToSlack({ client, channel, thread_ts, iter, initialText = 'Thinking…', stopAction = null }) {
  let ts = null;
  let buf = '';
  let last = 0;

  // Prepare stop button blocks if requested
  const stopBlocks = stopAction ? [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Generating response...*' }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Stop' },
          action_id: stopAction,
          style: 'danger'
        }
      ]
    }
  ] : undefined;

  try {
    for await (const chunk of iter) {
      buf += chunk;

      if (!ts) {
        const messageContent = initialText == null ? buf.slice(0, 3900) : initialText;
        const blockKitMessage = initialText == null ? formatResponseAsBlocks(messageContent) : { text: messageContent };
        
        const posted = await slackCall(client.chat.postMessage, {
          channel,
          thread_ts,
          ...blockKitMessage,
          blocks: stopBlocks
        });
        ts = posted.ts;
        last = initialText == null ? Date.now() : 0;
      }

      const now = Date.now();
      if (now - last > 700) {
        const blockKitMessage = formatResponseAsBlocks(buf.slice(0, 3900));
        await slackCall(client.chat.update, { 
          channel, 
          ts, 
          ...blockKitMessage,
          blocks: stopBlocks // Keep stop button during generation
        });
        last = now;
      }
    }

    if (ts) {
      // Final update - format as Block Kit and remove stop button when complete
      const blockKitMessage = formatResponseAsBlocks(buf.slice(0, 3900));
      await slackCall(client.chat.update, { 
        channel, 
        ts, 
        ...blockKitMessage // Use Block Kit format
      });
    }
  } catch (e) {
    logger.warn('streamToSlack error:', e?.data || e?.message || e);
  }
}

export function registerEvents(app) {
  // Add this at the top of registerEvents function
app.event('*', async ({ event, client, context }) => {
});
  // Cache the assistant thread root so replies land in the Assistant pane
  app.event('assistant_thread_started', async ({ event }) => {
    const channelId = event?.assistant_thread?.channel_id;
    const threadTs  = event?.assistant_thread?.thread_ts;
    if (channelId && threadTs) {
      await setAssistantThread(channelId, threadTs);
      logger.info('Cached assistant thread:', { channelId, threadTs });
    }
  });

  // Cache what the user is viewing (channel context for the Assistant pane)
  app.event('assistant_thread_context_changed', async ({ event }) => {
    const userId = event?.user;
    const ctx = event?.assistant_thread?.context || {};
    if (!userId) return;
    await setAssistantContextForUser(userId, ctx);
  });

  // @mentions in channels — check for ticket creation or normal chat behavior
  app.event('app_mention', async ({ event, client, context }) => {
    const team = context.teamId || event.team;
    const thread_ts = event.thread_ts || event.ts;
    const channel = event.channel;
    const user = event.user;
    const prompt = (event.text || '').replace(/<@[^>]+>\s*/, '').trim().slice(0, config.limits?.maxUserChars ?? 4000);

    // Check if this is a ticket creation request (not a question about how to create tickets)
    const ticketCreationKeywords = ['create ticket', 'make ticket', 'ticket for', 'file ticket', 'log ticket', 'create jira', 'make jira'];
    const questionKeywords = ['how do i', 'how to', 'what is', 'how can i', 'help me', 'show me', 'explain'];
    
    const lowerPrompt = prompt.toLowerCase();
    const hasTicketKeywords = ticketCreationKeywords.some(keyword => lowerPrompt.includes(keyword));
    const isQuestion = questionKeywords.some(question => lowerPrompt.includes(question));
    
    // Only treat as ticket creation if it has ticket keywords AND is not a question
    const isTicketRequest = hasTicketKeywords && !isQuestion;

    // Debug: log ticket detection logic

    if (isTicketRequest) {
      // Handle ticket creation
      try {
        const jiraConfig = await getJiraConfig(team);
        if (!jiraConfig) {
          await slackCall(client.chat.postMessage, {
            channel,
            thread_ts,
            text: '⚠️ Jira is not configured for this workspace. Please set it up in the App Home first.'
          });
          return;
        }

        // Get recent messages for context
        let recentMessages = [];
        try {
          const hist = await getRecentMessages(client, channel, { limit: 5 });
          if (hist.ok && hist.messages.length) {
            recentMessages = hist.messages;
          }
        } catch {}

        // Extract the ticket description (remove the ticket creation keywords)
        let ticketDescription = prompt;
        for (const keyword of ticketCreationKeywords) {
          // Replace the keyword but preserve connecting words like "for", "about", etc.
          ticketDescription = ticketDescription.replace(new RegExp(keyword, 'gi'), '').trim();
        }
        
        // Clean up extra whitespace and common connecting words at the start
        ticketDescription = ticketDescription.replace(/^(for|about|regarding|on|:|-)+\s*/i, '').trim();
        
        if (!ticketDescription || ticketDescription.length < 3) {
          await slackCall(client.chat.postMessage, {
            channel,
            thread_ts,
            text: '⚠️ Please provide a description for the ticket.\nExample: `@GrokAI create ticket for login bug - users cannot authenticate`'
          });
          return;
        }

        // Extract ticket information and create it
        const ticketData = extractTicketFromContext(ticketDescription, recentMessages);
        const result = await createJiraTicket(team, ticketData);

        if (result.success) {
          await slackCall(client.chat.postMessage, {
            channel,
            thread_ts,
            text: `✅ Jira ticket created successfully!\n🎫 *${result.ticket.key}*: ${result.ticket.summary}\n🔗 <${result.ticket.url}|View ticket>`
          });
        } else {
          await slackCall(client.chat.postMessage, {
            channel,
            thread_ts,
            text: `❌ Failed to create Jira ticket: ${result.error}`
          });
        }
        return;
      } catch (error) {
        await slackCall(client.chat.postMessage, {
          channel,
          thread_ts,
          text: `❌ Error creating ticket: ${error.message}`
        });
        return;
      }
    }

    // Check for dynamic action triggers first (bypass AI)
    try {
      const matchingTrigger = await findMatchingTrigger(team, user, prompt);
      if (matchingTrigger) {
        await slackCall(client.chat.postMessage, {
          channel,
          thread_ts,
          text: `⚡ ${matchingTrigger.response}`
        });
        return;
      }
    } catch (error) {
      logger.warn('Trigger check failed in @mention, continuing with AI:', error);
      // Continue with normal AI processing if trigger check fails
    }

    const key = convoKey({ team, channel, thread: thread_ts, user });
    await store.addUserTurn(key, prompt);

    const useRag = (config.features?.rag ?? config.rag?.enabled) === true;
    await initRagIfNeeded();
    const docContext = useRag ? await retrieveContext(prompt) : '';

    // Optional channel-aware context: channel metadata and recent messages
    let channelContextText = null;
    if (config.features?.channelContext !== false) {
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
    }

    // Optionally enrich with Data Access API results scoped to this channel
    let daBullets = '';
    const actionToken = event?.assistant_thread?.action_token;
    if (config.features?.dataAccess && actionToken) {
      const da = await assistantSearchContext(client, {
        query: prompt,
        action_token: actionToken,
        channel_id: channel,
        channel_types: 'public_channel,private_channel,mpim,im',
        content_types: 'messages',
        limit: 10,
        include_bots: false
      });
      if (da.ok) {
        daBullets = formatResultsAsBullets(da.results);
      }
    }

    const effectiveChannelContext = [channelContextText || '', daBullets || '']
      .filter(Boolean)
      .join('\n\nData Access context (most relevant first):\n');

    // Get user's agent settings
    const agentSettings = await getAgentSettings(team, user);
    
    const system = buildSystemPrompt({
      surface: 'channel',
      channelContextText: effectiveChannelContext || null,
      docContext,
      userMessage: prompt,
      agentSettings
    });

    const history = await store.history(key);
    const llmStream = getLLMStream();
    const iter = llmStream({ messages: history, system });

    await streamToSlack({
      client,
      channel,
      thread_ts,
      iter,
      initialText: 'Thinking…',
      stopAction: 'stop_generation' // Enable stop button in the actual response
    });
  });

  // Assistant pane / DMs — detect conversational intents; no Stop button here
  app.message(async ({ message, event, client, context }) => {
    if (message.subtype || !message.text) return;
    if (event.channel_type !== 'im') return;

    try {
      const team = context.teamId || event.team;
      const channel = event.channel;
      const user = message.user;
      const userText = String(message.text || '').slice(0, config.limits?.maxUserChars ?? 4000);

      // Anchor to the Assistant pane thread if we have it
      const assistantThreadTs = await getAssistantThread(channel);

    // Optional UI status
    if (assistantThreadTs) {
      try {
        await slackCall(client.assistant.threads.setStatus, {
          channel_id: channel,
          thread_ts: assistantThreadTs,
          status: 'is thinking...'
        });
      } catch (err) {
        if (err?.data?.error !== 'missing_scope') {
          logger.warn('assistant.threads.setStatus failed:', err?.data || err?.message);
        }
      }
    }

    // Check for dynamic action triggers first (bypass AI) 
    try {
      const matchingTrigger = await findMatchingTrigger(team, user, userText);
      if (matchingTrigger) {
        await streamToSlack({
          client,
          channel,
          thread_ts: assistantThreadTs || undefined,
          iter: (async function* () {
            yield `⚡ ${matchingTrigger.response}`;
          })(),
          initialText: null
        });
        return;
      }
    } catch (error) {
      logger.warn('Trigger check failed, continuing with AI:', error);
      // Continue with normal AI processing if trigger check fails
    }

    const key = convoKey({ team, channel, thread: null, user });
    await store.addUserTurn(key, userText);

    // ---------- Conversational intent: "summarize this channel" ----------
    const intent = detectIntent(userText);
    if (intent.type === 'summarize_channel') {
      const assistantCtx = await getAssistantContextForUser(user);
      const viewedChannelId = resolveViewedChannelId(assistantCtx);

      if (!viewedChannelId) {
        // No channel context available - ask user to specify
        const llmStream = getLLMStream();
        const iter = llmStream({
          messages: [{ 
            role: 'user', 
            content: `I don't have access to the current channel context. Please specify which channel you'd like me to tell you about (e.g., "#Duke Energy" or "the channel I'm viewing").` 
          }],
          system: 'Be helpful and ask for clarification about which channel they want information about.'
        });
        
        await streamToSlack({ 
          client, 
          channel, 
          thread_ts: assistantThreadTs || undefined, 
          iter, 
          initialText: null 
        });
        return;
      }

      // Prefer Data Access API scoped to viewedChannelId; fallback to recent messages
      const actionToken = event?.assistant_thread?.action_token;
      let iter;
      if (config.features?.dataAccess && actionToken) {
        const da = await assistantSearchContext(client, {
          query: 'summarize this channel',
          action_token: actionToken,
          channel_id: viewedChannelId,
          channel_types: 'public_channel,private_channel,mpim,im',
          content_types: 'messages',
          limit: 20,
          include_bots: false
        });

        if (da.ok && ((da.results?.messages || []).length > 0)) {
          const bullets = formatResultsAsBullets(da.results).slice(0, 12000);
          const system = `You are a Slack assistant. Using the provided relevant messages, ` +
            `summarize the channel in 5–7 concise bullets, call out decisions and action items, ` +
            `avoid PII, and add a one-line TL;DR.`;
          const llmStream = getLLMStream();
          iter = llmStream({
            messages: [{ role: 'user', content: bullets }],
            system
          });
        }
      }

      if (!iter) {
        // Channel metadata (auto-join public if permitted)
        let info = await getChannelInfo(client, viewedChannelId);
        if (!info.ok && info.error === 'not_in_channel') {
          const joined = await tryJoin(client, viewedChannelId);
          if (joined.ok) info = await getChannelInfo(client, viewedChannelId);
        }

        if (!info.ok || !info.channel) {
          const llmStream = getLLMStream();
          const iter2 = llmStream({
            messages: [{ role: 'user', content: `I couldn't read channel ${viewedChannelId}. Give a short, actionable explanation.` }],
            system: 'Be concise and actionable.'
          });
          await streamToSlack({ client, channel, thread_ts: assistantThreadTs || undefined, iter: iter2, initialText: null });
          return;
        }

        const cname = info.channel.is_private ? `(private) ${info.channel.name}` : `#${info.channel.name}`;
        const hist = await getRecentMessages(client, viewedChannelId, { limit: 48 });
        const corpus = (hist.messages || [])
          .filter((m) => m.type === 'message' && m.text)
          .map((m) => `${m.user || 'someone'}: ${m.text}`)
          .join('\n')
          .slice(0, 12000);

      const system =
        `You are a Slack assistant. Summarize recent messages from ${cname} in 5–7 concise bullets, ` +
        `call out decisions and action items, avoid PII, and add a one-line TL;DR.`;

        const llmStream = getLLMStream();
        iter = llmStream({
          messages: [{ role: 'user', content: corpus || '(no messages found)' }],
          system
        });
      }

      await streamToSlack({
        client,
        channel,
        thread_ts: assistantThreadTs || undefined,
        iter,
        initialText: null // Assistant-pane UX
      });

      return;
    }
    // ---------- End summarization branch ----------

    // Default chat behavior with (optional) channel metadata + recent message context
    let channelContextText = '';
    const assistantCtx = await getAssistantContextForUser(user);
    const viewedChannelId = resolveViewedChannelId(assistantCtx);

    // DEBUG: Log what we're getting


        // Fallback: Handle both channel names and channel IDs
        if (!viewedChannelId) {
          // Try to extract channel reference from user message
          const channelMatch = userText.match(/#([a-zA-Z0-9\s-]+)/i);
          const channelRef = channelMatch ? channelMatch[1].trim() : null;
          
          if (channelRef) {
            try {
              // Check if it's a channel ID (starts with C)
              if (channelRef.startsWith('C') && channelRef.length > 8) {
                // It's a channel ID - use it directly
                const info = await getChannelInfo(client, channelRef);
                const hist = await getRecentMessages(client, channelRef, { limit: 20 });
                
                let channelInfo = '';
                if (info.ok && info.channel) {
                  const c = info.channel;
                  const cname = c.is_private ? `(private) ${c.name}` : `#${c.name}`;
                  const topic = c.topic?.value ? `Topic: ${c.topic.value}` : '';
                  const purpose = c.purpose?.value ? `Purpose: ${c.purpose.value}` : '';
                  channelInfo = `Channel: ${cname}\n${topic}\n${purpose}`.trim();
                }
                
                let recentMessages = '';
                if (hist.ok && hist.messages.length) {
                  const messages = hist.messages
                    .filter(m => m.type === 'message' && m.text)
                    .map(m => `- ${m.user || 'someone'}: ${m.text}`)
                    .join('\n');
                  if (messages) recentMessages = `\n\nRecent messages:\n${messages}`;
                }
                
                const system = `You are a Slack assistant. Provide a helpful summary of the channel based on the provided information.`;
                const llmStream = getLLMStream();
                const iter = llmStream({
                  messages: [{ role: 'user', content: `${channelInfo}${recentMessages}` }],
                  system
                });
                
                await streamToSlack({ 
                  client, 
                  channel, 
                  thread_ts: assistantThreadTs || undefined, 
                  iter, 
                  initialText: null 
                });
                return;
              } else {
                // It's a channel name - search for it
                const channels = await slackCall(client.conversations.list, { 
                  types: 'public_channel,private_channel',
                  limit: 50
                });
                
                const targetChannel = channels.channels?.find(c => 
                  c.name.toLowerCase().includes(channelRef.toLowerCase())
                );
                
                if (targetChannel) {
                  // Found the channel by name - get info and recent messages
                  const info = await getChannelInfo(client, targetChannel.id);
                  const hist = await getRecentMessages(client, targetChannel.id, { limit: 20 });
                  
                  let channelInfo = '';
                  if (info.ok && info.channel) {
                    const c = info.channel;
                    const cname = c.is_private ? `(private) ${c.name}` : `#${c.name}`;
                    const topic = c.topic?.value ? `Topic: ${c.topic.value}` : '';
                    const purpose = c.purpose?.value ? `Purpose: ${c.purpose.value}` : '';
                    channelInfo = `Channel: ${cname}\n${topic}\n${purpose}`.trim();
                  }
                  
                  let recentMessages = '';
                  if (hist.ok && hist.messages.length) {
                    const messages = hist.messages
                      .filter(m => m.type === 'message' && m.text)
                      .map(m => `- ${m.user || 'someone'}: ${m.text}`)
                      .join('\n');
                    if (messages) recentMessages = `\n\nRecent messages:\n${messages}`;
                  }
                  
                  const system = `You are a Slack assistant. Provide a helpful summary of the channel based on the provided information.`;
                  const llmStream = getLLMStream();
                  const iter = llmStream({
                    messages: [{ role: 'user', content: `${channelInfo}${recentMessages}` }],
                    system
                  });
                  
                  await streamToSlack({ 
                    client, 
                    channel, 
                    thread_ts: assistantThreadTs || undefined, 
                    iter, 
                    initialText: null 
                  });
                  return;
                } else {
                  // Channel name not found
                  const llmStream = getLLMStream();
                  const iter = llmStream({
                    messages: [{ 
                      role: 'user', 
                      content: `I couldn't find a channel named "#${channelRef}". Please check the spelling or make sure I have access to that channel.` 
                    }],
                    system: 'Be helpful and suggest checking the channel name.'
                  });
                  
                  await streamToSlack({ 
                    client, 
                    channel, 
                    thread_ts: assistantThreadTs || undefined, 
                    iter, 
                    initialText: null 
                  });
                  return;
                }
              }
            } catch (e) {
            }
          }
          
          // No channel reference - treat as regular conversation
          const key = convoKey({ team, channel, thread: assistantThreadTs || null, user });
          await store.addUserTurn(key, userText);

          // Get user's agent settings
          const agentSettings = await getAgentSettings(team, user);
          
          const system = buildSystemPrompt({
            surface: 'assistant',
            channelContextText: null,
            docContext: '',
            userMessage: userText,
            agentSettings
          });

          const history = await store.history(key);
          const llmStream = getLLMStream();
          const iter = llmStream({ messages: history, system });

          await streamToSlack({ 
            client, 
            channel, 
            thread_ts: assistantThreadTs || undefined, 
            iter, 
            initialText: null 
          });
          return;
        }
    } catch (error) {
      logger.error('Assistant message error:', error);
    }
  });

  // App Home opened
  app.event('app_home_opened', async ({ event, client, context }) => {
    try {
      const userId = event.user;
      const teamId = context.teamId || event.team_id || event.team || 'unknown';
      
      
      // Check if user is admin
      const userInfo = await client.users.info({ user: userId });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      
      // Always get Jira config to show proper status (admin controls are separate)
      const { getJiraConfig } = await import('../services/jira.js');
      const jiraConfig = await getJiraConfig(teamId);
      
      // Get user's agent settings
      const agentSettings = await getAgentSettings(teamId, userId);
      
      await client.views.publish({
        user_id: userId,
        view: homeView(isAdmin, jiraConfig, agentSettings)
      });
    } catch (error) {
      logger.error('App Home error:', error);
    }
  });
} 