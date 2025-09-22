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
import { getSuggestedPromptButtons, getSuggestedPromptsForAPI } from '../services/assistantPanel.js';
import { isChannelMonitored, incrementThreadResponseCount } from '../services/channelMonitoring.js';
import { createCanvasFromResponse, isCanvasCreationRequest, extractCanvasContent } from '../services/canvas.js';
import { getInstallation } from '../services/installations.js';
import { Assistant } from '@slack/bolt';

/** Helper function to handle Canvas creation requests */
async function handleCanvasCreation(client, teamId, userId, channelId, userMessage, agentSettings) {
  try {
    // Check if user has Canvas creation enabled and is requesting it
    if (agentSettings?.autoCreateCanvas && isCanvasCreationRequest(userMessage)) {
      logger.info('User requesting Canvas creation:', { teamId, userId, channelId, message: userMessage });
      
      const canvasTopic = extractCanvasContent(userMessage);
      
      if (!canvasTopic || canvasTopic.length < 3) {
        await client.chat.postMessage({
          channel: channelId,
          text: '⚠️ Please provide a topic for the Canvas.\nExample: "create canvas about machine learning" or "create canvas for project planning"'
        });
        return null;
      }
      
      const title = canvasTopic.length > 50 ? 
        `${canvasTopic.substring(0, 50)}...` : 
        canvasTopic;
      
      // Generate AI content about the topic first
      logger.info('Generating AI content for Canvas topic:', { topic: canvasTopic });
      
      // Create a prompt for the AI to generate content about the topic
      const aiPrompt = `Create comprehensive content about: ${canvasTopic}. Provide detailed information, key points, and actionable insights. Format it clearly with headers and bullet points for a Canvas document.`;
      
      // Get AI response using the same LLM service
      const key = convoKey({ team: teamId, channel: channelId, thread: null, user: userId });
      await store.addUserTurn(key, aiPrompt);
      
      const history = await store.history(key);
      const system = buildSystemPrompt({
        surface: 'channel',
        channelContextText: '',
        docContext: '',
        userMessage: aiPrompt,
        agentSettings
      });
      
      const llmStream = getLLMStream();
      const iter = llmStream({ messages: history, system });
      
      // Collect the AI response
      let aiResponse = '';
      for await (const chunk of iter) {
        aiResponse += chunk;
      }
      
      // Add the AI response to conversation history
      await store.addAssistantTurn(key, aiResponse);
      
      logger.info('AI content generated for Canvas:', { topic: canvasTopic, responseLength: aiResponse.length });
      
      // Get workspace domain for proper Canvas URL
      let workspaceDomain = null;
      try {
        const installation = await getInstallation({ teamId: teamId });
        if (installation.team?.domain) {
          workspaceDomain = `${installation.team.domain}.slack.com`;
        }
      } catch (error) {
        logger.warn('Could not get workspace domain:', error.message);
      }
      
      // Now create Canvas with the AI-generated content
      const canvasResult = await createCanvasFromResponse(
        client,
        channelId,
        aiResponse,
        title,
        userMessage,
        workspaceDomain,
        teamId
      );
      
      if (canvasResult.success) {
        logger.info('Canvas created successfully:', { canvasId: canvasResult.canvasId });
        
        // Share the Canvas with the user and get the proper URL
        try {
          const shareResult = await client.canvases.access.set({
            canvas_id: canvasResult.canvasId,
            user_ids: [userId]
          });
          
          if (shareResult.ok) {
            logger.info('Canvas shared with user successfully');
          } else {
            logger.warn('Failed to share Canvas with user:', shareResult.error);
          }
        } catch (shareError) {
          logger.warn('Error sharing Canvas with user:', shareError.message);
        }
        
        // Post a message with the canvas link in the Assistant thread
        const assistantThreadTs = await getAssistantThread(channelId);
        
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: assistantThreadTs || undefined,
          text: `📄 *Here's your Canvas about ${canvasTopic}*\n\n<${canvasResult.url}|View Canvas: ${title}>`
        });
        
        return canvasResult;
      } else {
        logger.error('Failed to create Canvas:', canvasResult.error);
        const assistantThreadTs = await getAssistantThread(channelId);
        
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: assistantThreadTs || undefined,
          text: `❌ Failed to create Canvas: ${canvasResult.error}`
        });
      }
    }
  } catch (error) {
    logger.error('Error handling Canvas creation:', error);
    await client.chat.postMessage({
      channel: channelId,
      text: `❌ Error creating Canvas: ${error.message}`
    });
  }
  return null;
}

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

/** Check if a message is requesting Jira ticket creation */
function isTicketCreationRequest(message) {
  const ticketCreationKeywords = ['create ticket', 'make ticket', 'ticket for', 'file ticket', 'log ticket', 'create jira', 'make jira'];
  const questionKeywords = ['how do i', 'how to', 'what is', 'how can i', 'help me', 'show me', 'explain'];
  
  const lowerMessage = message.toLowerCase();
  const hasTicketKeywords = ticketCreationKeywords.some(keyword => lowerMessage.includes(keyword));
  const isQuestion = questionKeywords.some(question => lowerMessage.includes(question));
  
  logger.info('Ticket detection:', { 
    message, 
    lowerMessage, 
    hasTicketKeywords, 
    isQuestion, 
    result: hasTicketKeywords && !isQuestion 
  });
  
  // Only treat as ticket creation if it has ticket keywords AND is not a question
  return hasTicketKeywords && !isQuestion;
}

/** Extract ticket description from user message */
function extractTicketDescription(message) {
  const ticketCreationKeywords = ['create ticket', 'make ticket', 'ticket for', 'file ticket', 'log ticket', 'create jira', 'make jira'];
  
  let ticketDescription = message;
  for (const keyword of ticketCreationKeywords) {
    // Replace the keyword but preserve connecting words like "for", "about", etc.
    ticketDescription = ticketDescription.replace(new RegExp(keyword, 'gi'), '').trim();
  }
  
  // Clean up extra whitespace and common connecting words at the start
  ticketDescription = ticketDescription.replace(/^(for|about|regarding|on|:|-)+\s*/i, '').trim();
  
  return ticketDescription;
}

/** Streaming helper. If initialText is null, first token creates the message (Assistant pane UX). */
async function streamToSlack({ client, channel, thread_ts, iter, initialText = 'Thinking…', stopAction = null, useBlockKit = false }) {
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
        const messageFormat = initialText == null && useBlockKit ? formatResponseAsBlocks(messageContent) : { text: messageContent };
        
        const posted = await slackCall(client.chat.postMessage, {
          channel,
          thread_ts,
          ...messageFormat,
          blocks: stopBlocks
        });
        ts = posted.ts;
        last = initialText == null ? Date.now() : 0;
      }

      const now = Date.now();
      if (now - last > 700) {
        const messageFormat = useBlockKit ? formatResponseAsBlocks(buf.slice(0, 3900)) : { text: buf.slice(0, 3900) };
        await slackCall(client.chat.update, { 
          channel, 
          ts, 
          ...messageFormat,
          blocks: stopBlocks // Keep stop button during generation
        });
        last = now;
      }
    }

    if (ts) {
      // Final update - conditionally format as Block Kit and remove stop button when complete
      const messageFormat = useBlockKit ? formatResponseAsBlocks(buf.slice(0, 3900)) : { text: buf.slice(0, 3900) };
      await slackCall(client.chat.update, { 
        channel, 
        ts, 
        ...messageFormat
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

  // Function to set suggested prompts using Slack's official API
  async function setSuggestedPromptsForAssistant(client, userId, teamId, channelId, threadTs) {
    try {
      logger.info('Setting suggested prompts for assistant:', { userId, teamId, channelId, threadTs });
      
      const suggestedPrompts = await getSuggestedPromptsForAPI(teamId, userId);
      logger.info('Retrieved suggested prompts:', { userId, promptCount: suggestedPrompts.length, prompts: suggestedPrompts });
      
      if (suggestedPrompts.length === 0) {
        logger.info('No suggested prompts to set for user:', userId);
        return;
      }
      
      // Use Slack's official assistant.threads.setSuggestedPrompts API
      logger.info('Calling assistant.threads.setSuggestedPrompts API...');
      const result = await client.assistant.threads.setSuggestedPrompts({
        channel_id: channelId,
        thread_ts: threadTs,
        prompts: suggestedPrompts
      });
      
      logger.info('API call result:', result);
      
      if (result.ok) {
        logger.info('Successfully set suggested prompts:', { userId, promptCount: suggestedPrompts.length });
      } else {
        logger.error('Failed to set suggested prompts:', result.error);
      }
    } catch (error) {
      logger.error('Error setting suggested prompts:', error);
    }
  }

  // Function to display welcome message with suggested prompt buttons in assistant panel (fallback)
  async function displayWelcomeMessageWithPrompts(client, userId, teamId) {
    try {
      const promptButtons = await getSuggestedPromptButtons(teamId, userId);
      
      // Always send a welcome message, with or without suggested prompts
      const welcomeBlocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `👋 *Welcome! I'm your AI Assistant.*\n\nI can help you with questions, create tickets, summarize conversations, and much more. How can I assist you today?`
          }
        }
      ];
      
      // Add suggested prompt buttons if they exist
      if (promptButtons) {
        welcomeBlocks.push({ type: 'divider' });
        welcomeBlocks.push(...promptButtons);
      }
      
      // Send the welcome message with suggested prompt buttons
      await client.chat.postMessage({
        channel: userId,
        text: 'Welcome! I\'m your AI Assistant. How can I help you today?',
        blocks: welcomeBlocks
      });
    } catch (error) {
      logger.error('Error displaying welcome message with prompts:', error);
    }
  }
  // Handle assistant thread started with suggested prompts (raw event handler)
  app.event('assistant_thread_started', async ({ event, client, context }) => {
    const channelId = event?.assistant_thread?.channel_id;
    const threadTs = event?.assistant_thread?.thread_ts;
    const userId = event?.assistant_thread?.user_id;
    const teamId = context.teamId;
    
    logger.info('Assistant thread started:', { userId, teamId, channelId, threadTs, fullEvent: event });
    
    if (channelId && threadTs) {
      await setAssistantThread(channelId, threadTs);
    }
    
    try {
      // Send welcome message
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: '👋 Hi! I\'m your AI Assistant. How can I help you today?'
      });
      
      // Get user's suggested prompts and convert to proper format
      const suggestedPrompts = await getSuggestedPromptsForAPI(teamId, userId);
      logger.info('Retrieved suggested prompts:', { userId, teamId, promptCount: suggestedPrompts.length, prompts: suggestedPrompts });
      
      if (suggestedPrompts.length > 0) {
        // Convert to the format expected by the API: { prompts: [{ title, message }] }
        const prompts = suggestedPrompts.map(prompt => ({
          title: prompt.text,    // Button text
          message: prompt.value  // Message sent when clicked
        }));
        
        logger.info('About to call assistant.threads.setSuggestedPrompts with:', {
          channel_id: channelId,
          thread_ts: threadTs,
          prompts: prompts
        });
        
        // Use the raw API call with proper format
        const result = await client.assistant.threads.setSuggestedPrompts({
          channel_id: channelId,
          thread_ts: threadTs,
          prompts: prompts
        });
        
        logger.info('assistant.threads.setSuggestedPrompts result:', result);
        
        if (result.ok) {
          logger.info('Successfully set suggested prompts via API');
        } else {
          logger.error('Failed to set suggested prompts:', result.error);
        }
      } else {
        logger.info('No suggested prompts to set for user');
      }
      
    } catch (error) {
      logger.error('Error in assistant_thread_started:', error);
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

    // Check for Canvas creation requests first
    const userAgentSettings = await getAgentSettings(team, user);
    if (isCanvasCreationRequest(prompt)) {
      const canvasResult = await handleCanvasCreation(client, team, user, channel, prompt, userAgentSettings);
      if (canvasResult) {
        return; // Canvas was created, don't process further
      }
    }

    // Check if this is a ticket creation request
    const isTicketRequest = isTicketCreationRequest(prompt);

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
        const ticketDescription = extractTicketDescription(prompt);
        
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
      agentSettings,
      useBlockKit: true // Use Block Kit for channel responses
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
      stopAction: 'stop_generation', // Enable stop button in the actual response
      useBlockKit: true // Use Block Kit for channel responses
    });
  });

  // Channel messages — check for monitored channels
  app.message(async ({ message, event, client, context }) => {
    // Skip system messages but allow bot messages
    const systemSubtypes = ['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'channel_archive', 'channel_unarchive', 'pinned_item', 'unpinned_item'];
    if (systemSubtypes.includes(message.subtype)) return;
    if (!message.text) return;
    if (event.channel_type !== 'channel') return;

    try {
      const team = context.teamId || event.team;
      const channel = event.channel;
      const user = message.user;
      const userText = String(message.text || '').slice(0, config.limits?.maxUserChars ?? 4000);

      logger.info('Processing message in channel:', { 
        team, 
        channel, 
        user, 
        subtype: message.subtype,
        bot_id: message.bot_id,
        hasText: !!message.text,
        textPreview: userText.substring(0, 50)
      });

      // Check if this channel is being monitored
      const monitoredChannel = await isChannelMonitored(team, channel);
      if (!monitoredChannel) {
        return; // Channel is not being monitored
      }

      logger.info('Processing message in monitored channel:', { 
        team, 
        channel, 
        user, 
        responseType: monitoredChannel.responseType 
      });

      // Get user's agent settings
      const agentSettings = await getAgentSettings(team, user);
      
      // Build system prompt based on response type
      let systemPrompt;
      switch (monitoredChannel.responseType) {
        case 'analytical':
          systemPrompt = `You are an analytical assistant monitoring this channel. Analyze the recent message for insights, patterns, and key points. Provide thoughtful analysis in a thread reply. Keep responses concise and focused on actionable insights.`;
          break;
        case 'summary':
          systemPrompt = `You are a summarization assistant monitoring this channel. Provide a concise summary of the recent message and its context. Keep summaries brief and highlight key points.`;
          break;
        case 'questions':
          systemPrompt = `You are a facilitation assistant monitoring this channel. Ask thoughtful, clarifying questions about the recent message to help facilitate better discussion. Focus on questions that add value and encourage deeper thinking.`;
          break;
        case 'insights':
          systemPrompt = `You are an insights assistant monitoring this channel. Share observations and actionable insights about the recent message. Focus on practical takeaways and next steps.`;
          break;
        default:
          systemPrompt = `You are monitoring this channel and responding to messages. Provide a helpful response based on the recent message.`;
      }

      // Get recent context for better responses
      const key = convoKey({ team, channel, thread: null, user });
      await store.addUserTurn(key, userText);

      // Get recent messages for context
      let recentMessages = [];
      try {
        const hist = await getRecentMessages(client, channel, { limit: 10 });
        if (hist.ok && hist.messages.length) {
          recentMessages = hist.messages;
        }
      } catch {}

      // Build context from recent messages
      const contextText = recentMessages.length > 0 
        ? recentMessages.slice(-5).map(m => `${m.user}: ${m.text}`).join('\n')
        : userText;

      const system = buildSystemPrompt({
        surface: 'channel',
        channelContextText: contextText,
        docContext: '',
        userMessage: userText,
        agentSettings
      }) + '\n\n' + systemPrompt;

      const history = await store.history(key);
      const llmStream = getLLMStream();
      const iter = llmStream({ messages: history, system });

      // Respond in thread to keep main channel clean
      await streamToSlack({
        client,
        channel,
        thread_ts: message.ts, // Reply in thread
        iter,
        initialText: null,
        useBlockKit: false // Use simple text for thread responses
      });

      // Check if we should create a Jira ticket (after 2nd bot response)
      logger.info('Checking auto-Jira ticket creation:', { 
        autoCreateJiraTickets: monitoredChannel.autoCreateJiraTickets,
        team, 
        channel, 
        threadTs: message.ts 
      });
      
      if (monitoredChannel.autoCreateJiraTickets) {
        const responseCount = await incrementThreadResponseCount(team, channel, message.ts);
        
        logger.info('Thread response count:', { 
          team, 
          channel, 
          threadTs: message.ts, 
          responseCount 
        });
        
        if (responseCount === 1) {
          logger.info('Creating auto Jira ticket after 1st bot response:', { team, channel, threadTs: message.ts });
          
          try {
            // Get recent messages for context
            let recentMessages = [];
            try {
              const hist = await getRecentMessages(client, channel, { limit: 10 });
              if (hist.ok && hist.messages.length) {
                recentMessages = hist.messages;
              }
            } catch {}

            // Create a summary for the Jira ticket
            const ticketDescription = `Auto-generated ticket from monitored channel #${monitoredChannel.channelName}\n\nThread started by: ${userText}\nResponse Type: ${monitoredChannel.responseType}\n\nThis ticket was automatically created after the bot's 1st response in the thread to track ongoing discussion and ensure follow-up.`;

            // Extract ticket information and create it
            const ticketData = extractTicketFromContext(ticketDescription, recentMessages);
            
            // Clean up the summary to remove newlines (Jira doesn't allow them in summary)
            if (ticketData.summary) {
              ticketData.summary = ticketData.summary.replace(/[\r\n]+/g, ' ').trim();
              // Ensure summary isn't too long (Jira limit is typically 255 characters)
              if (ticketData.summary.length > 200) {
                ticketData.summary = ticketData.summary.substring(0, 197) + '...';
              }
            }
            
            logger.info('Ticket data for auto-Jira creation:', ticketData);
            
            const jiraResult = await createJiraTicket(team, ticketData);
            logger.info('Jira creation result:', jiraResult);

            if (jiraResult.success) {
              // Post the Jira ticket link in the thread
              await client.chat.postMessage({
                channel: channel,
                thread_ts: message.ts,
                text: `🎫 *Auto-Created Jira Ticket*\n\n<${jiraResult.ticket.url}|${jiraResult.ticket.key}>: ${jiraResult.ticket.summary}\n\nThis ticket was automatically created to track this ongoing discussion.`
              });
              
              logger.info('Auto Jira ticket created successfully:', jiraResult.ticket);
            } else {
              logger.error('Failed to create auto Jira ticket:', jiraResult.error);
            }
          } catch (error) {
            logger.error('Error creating auto Jira ticket:', error);
          }
        }
      }

    } catch (error) {
      logger.error('Error processing monitored channel message:', error);
    }
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

    // Check for Canvas creation requests first
    const userAgentSettings = await getAgentSettings(team, user);
    if (isCanvasCreationRequest(userText)) {
      const canvasResult = await handleCanvasCreation(client, team, user, channel, userText, userAgentSettings);
      if (canvasResult) {
        return; // Canvas was created, don't process further
      }
    }

    // Check for Jira ticket creation requests
    logger.info('Checking ticket creation request:', { userText, isTicketRequest: isTicketCreationRequest(userText) });
    if (isTicketCreationRequest(userText)) {
      try {
        const jiraConfig = await getJiraConfig(team);
        if (!jiraConfig) {
          await streamToSlack({
            client,
            channel,
            thread_ts: assistantThreadTs || undefined,
            iter: (async function* () {
              yield '⚠️ Jira is not configured for this workspace. Please set it up in the App Home first.';
            })(),
            initialText: null
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

        // Extract the ticket description
        const ticketDescription = extractTicketDescription(userText);
        
        if (!ticketDescription || ticketDescription.length < 3) {
          await streamToSlack({
            client,
            channel,
            thread_ts: assistantThreadTs || undefined,
            iter: (async function* () {
              yield '⚠️ Please provide a description for the ticket.\nExample: `create ticket for login bug - users cannot authenticate`';
            })(),
            initialText: null
          });
          return;
        }

        // Extract ticket information and create it
        const ticketData = extractTicketFromContext(ticketDescription, recentMessages);
        const result = await createJiraTicket(team, ticketData);

        await streamToSlack({
          client,
          channel,
          thread_ts: assistantThreadTs || undefined,
          iter: (async function* () {
            if (result.success) {
              yield `✅ Jira ticket created successfully!\n🎫 *${result.ticket.key}*: ${result.ticket.summary}\n🔗 <${result.ticket.url}|View ticket>`;
            } else {
              yield `❌ Failed to create Jira ticket: ${result.error}`;
            }
          })(),
          initialText: null
        });
        return;
      } catch (error) {
        await streamToSlack({
          client,
          channel,
          thread_ts: assistantThreadTs || undefined,
          iter: (async function* () {
            yield `❌ Error creating ticket: ${error.message}`;
          })(),
          initialText: null
        });
        return;
      }
    }

    // Check for dynamic action triggers (bypass AI) 
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