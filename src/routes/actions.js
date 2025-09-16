// src/routes/actions.js
import {
  clearAllUserState,
  deleteAssistantThread
} from '../services/memory.js';
import { homeView } from '../ui/views.js';

export function registerActions(app) {
  // App Home → Clear cached history
  app.action('reset_memory', async ({ ack, body, client, context }) => {
    await ack();

    try {
      const team = context.teamId || body?.team?.id;
      const user = body.user?.id;

      // 1) Clear conversation turns + assistant context
      const { removedConvos } = await clearAllUserState(team, user);

      // 2) Clear the cached assistant-thread root for this user’s IM channel
      //    We open (or get) the IM with this user to know the channel id.
      const imOpen = await client.conversations.open({ users: user });
      const imChannelId = imOpen?.channel?.id;
      if (imChannelId) {
        await deleteAssistantThread(imChannelId);
      }

      // 3) Let the user know + guide them to re-anchor
      await client.chat.postMessage({
        channel: user,
        text:
          `Cleared your cached history ✅ (removed ${removedConvos} conversation keys and assistant context). ` +
          `I also reset my Assistant thread link for our DM. ` +
          `Please click *New Chat* in the Assistant panel to start a fresh thread.`
      });

      // 4) Re-render Home tab
      await client.views.publish({
        user_id: user,
        view: homeView()
      });
    } catch (err) {
      const user = body.user?.id;
      if (user) {
        await client.chat.postMessage({
          channel: user,
          text: `Sorry — I couldn’t clear your cached history. (${err?.data?.error || err?.message || 'unknown error'})`
        });
      }
    }
  });

  // Clear cache action from App Home
  app.action('clear_cache', async ({ ack, body, client }) => {
    await ack();

    try {
      const user = body.user?.id;
      const team = body.team?.id;

      // Clear all user state
      const { clearAllState } = await import('../services/memory.js');
      await clearAllState();

      // Send confirmation message
      await client.chat.postMessage({
        channel: user,
        text: '🧹 Cache cleared successfully! All conversation history and state has been reset.'
      });

      // Update App Home
      await client.views.publish({
        user_id: user,
        view: {
          type: 'home',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Welcome to AI Assistant!* 🤖\n\n✅ *Cache cleared successfully!*'
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*How to use me:*\n• Send me direct messages\n• Use `/ask` command in channels\n• Mention me with `@AI Assistant` in channels\n• For channel info, use: `tell me about #channel-name`'
              }
            }
          ]
        }
      });

    } catch (error) {
      const user = body.user?.id;
      if (user) {
        await client.chat.postMessage({
          channel: user,
          text: `❌ Error clearing cache: ${error.message}`
        });
      }
    }
  });

  // Stop button action
  app.action('stop_generation', async ({ ack, body, client }) => {
    await ack();
    
    try {
      const user = body.user?.id;
      const channel = body.channel?.id;
      const messageTs = body.message?.ts;
      
      if (messageTs) {
        // Update the message to show it was stopped
        await client.chat.update({
          channel,
          ts: messageTs,
          text: '⏹️ Generation stopped by user.',
          blocks: []
        });
        
        console.log(`🛑 Generation stopped by user ${user} in ${channel}`);
      }
    } catch (error) {
      console.error('Stop button error:', error);
    }
  });
}
