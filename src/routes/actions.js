// src/routes/actions.js
import {
  clearAllUserState,
  deleteAssistantThread
} from '../services/memory.js';
import { homeView, jiraSetupModal } from '../ui/views.js';
import { getJiraConfig, saveJiraConfig, testJiraConnection } from '../services/jira.js';

export function registerActions(app) {
  // Remove catch-all debug handler to prevent spam

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

      // 4) Re-render Home tab with proper context
      const userInfo = await client.users.info({ user });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      const jiraConfig = await getJiraConfig(team);
      
      await client.views.publish({
        user_id: user,
        view: homeView(isAdmin, jiraConfig)
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
        text: '🧹 Cache cleared successfully! All conversation history and state has been reset.\n\n✅ Your Jira integration settings are preserved and remain active.'
      });

      // Update App Home with proper context
      const userInfo = await client.users.info({ user });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      const jiraConfig = await getJiraConfig(team);
      
      await client.views.publish({
        user_id: user,
        view: homeView(isAdmin, jiraConfig)
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

  // Jira setup button
  app.action('setup_jira', async ({ ack, body, client }) => {
    await ack();
    
    try {
      const user = body.user?.id;
      const teamId = body.team?.id;
      
      // Check if user is admin
      const userInfo = await client.users.info({ user });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      
      if (!isAdmin) {
        await client.chat.postEphemeral({
          channel: user,
          user,
          text: '⚠️ Only workspace admins can configure Jira integration.'
        });
        return;
      }
      
      // Open Jira setup modal
      await client.views.open({
        trigger_id: body.trigger_id,
        view: jiraSetupModal()
      });
      
    } catch (error) {
      console.error('Jira setup error:', error);
    }
  });

  // Jira update button
  app.action('update_jira', async ({ ack, body, client }) => {
    await ack();
    
    try {
      const teamId = body.team?.id;
      const existingConfig = await getJiraConfig(teamId);
      
      await client.views.open({
        trigger_id: body.trigger_id,
        view: jiraSetupModal(existingConfig)
      });
      
    } catch (error) {
      console.error('Jira update error:', error);
    }
  });

  // Jira setup modal submission
  app.view('jira_setup', async ({ ack, body, client, view }) => {
    await ack();
    
    try {
      const teamId = body.team?.id;
      const user = body.user?.id;
      
      // Extract form values
      const values = view.state.values;
      const config = {
        baseUrl: values.jira_url.url_input.value,
        email: values.jira_email.email_input.value,
        apiToken: values.jira_token.token_input.value,
        defaultProject: values.jira_project.project_input.value,
        defaultIssueType: values.jira_issue_type.issue_type_input.value || 'Task'
      };
      
      // Test connection
      const testResult = await testJiraConnection(config);
      
      if (!testResult.success) {
        // Send error message
        await client.chat.postEphemeral({
          channel: user,
          user,
          text: `❌ Jira connection failed: ${testResult.error}\n\nPlease check your credentials and try again.`
        });
        return;
      }
      
      // Save configuration
      const saved = await saveJiraConfig(teamId, config);
      
      if (saved) {
        await client.chat.postEphemeral({
          channel: user,
          user,
          text: `✅ Jira integration configured successfully!\n\nConnected to: ${config.baseUrl}\nDefault project: ${config.defaultProject}`
        });
        
        // Refresh App Home to show new status
        const userInfo = await client.users.info({ user });
        const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
        const jiraConfig = await getJiraConfig(teamId);
        
        await client.views.publish({
          user_id: user,
          view: homeView(isAdmin, jiraConfig)
        });
      } else {
        await client.chat.postEphemeral({
          channel: user,
          user,
          text: '❌ Failed to save Jira configuration. Please try again.'
        });
      }
      
    } catch (error) {
      console.error('Jira setup submission error:', error);
      await client.chat.postEphemeral({
        channel: body.user?.id,
        user: body.user?.id,
        text: `❌ Error setting up Jira: ${error.message}`
      });
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
