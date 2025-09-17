// src/routes/actions.js
import {
  clearAllUserState,
  deleteAssistantThread
} from '../services/memory.js';
import { 
  homeView, 
  jiraSetupModal, 
  addTriggerModal, 
  manageTriggerModal, 
  importTemplatesModal 
} from '../ui/views.js';
import { getJiraConfig, saveJiraConfig, testJiraConnection } from '../services/jira.js';
import { 
  saveTrigger, 
  getPersonalTriggers, 
  deleteTrigger, 
  toggleTrigger, 
  importTemplates 
} from '../services/triggers.js';

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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const userInfo = await client.users.info({ user });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      const jiraConfig = await getJiraConfig(team);
      
      console.log('🏠 Updating App Home after reset memory:', { 
        user, 
        team, 
        isAdmin, 
        hasJiraConfig: !!jiraConfig,
        jiraBaseUrl: jiraConfig?.baseUrl 
      });
      
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

      // Update App Home with proper context (add small delay to ensure Redis consistency)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const userInfo = await client.users.info({ user });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      const jiraConfig = await getJiraConfig(team);
      
      console.log('🏠 Updating App Home after clear cache:', { 
        user, 
        team, 
        isAdmin, 
        hasJiraConfig: !!jiraConfig,
        jiraBaseUrl: jiraConfig?.baseUrl 
      });
      
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

  // ==================== TRIGGER ACTIONS ====================

  // Add Trigger button
  app.action('add_trigger', async ({ ack, body, client }) => {
    await ack();
    
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: addTriggerModal()
      });
    } catch (error) {
      console.error('Add trigger modal error:', error);
    }
  });

  // Manage Triggers button
  app.action('manage_triggers', async ({ ack, body, client, context }) => {
    await ack();
    
    try {
      const teamId = context.teamId || body.team?.id;
      const userId = body.user?.id;
      
      const triggers = await getPersonalTriggers(teamId, userId);
      
      await client.views.open({
        trigger_id: body.trigger_id,
        view: manageTriggerModal(triggers)
      });
    } catch (error) {
      console.error('Manage triggers modal error:', error);
    }
  });

  // Import Templates button
  app.action('import_templates', async ({ ack, body, client }) => {
    await ack();
    
    try {
      await client.views.open({
        trigger_id: body.trigger_id,
        view: importTemplatesModal()
      });
    } catch (error) {
      console.error('Import templates modal error:', error);
    }
  });

  // Trigger overflow menu actions
  app.action(/^trigger_actions_(.+)$/, async ({ ack, body, client, context, action }) => {
    await ack();
    
    try {
      const teamId = context.teamId || body.team?.id;
      const userId = body.user?.id;
      const triggerId = action.action_id.split('_')[2];
      const selectedValue = action.selected_option?.value;
      
      if (!selectedValue) return;
      
      const [actionType, targetId] = selectedValue.split('_');
      
      const userInfo = await client.users.info({ user: userId });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      
      switch (actionType) {
        case 'edit':
          // Get trigger data and open edit modal
          const triggers = await getPersonalTriggers(teamId, userId);
          const triggerToEdit = triggers.find(t => t.id === targetId);
          
          if (triggerToEdit) {
            await client.views.open({
              trigger_id: body.trigger_id,
              view: addTriggerModal(triggerToEdit)
            });
          }
          break;
          
        case 'delete':
          const deleteResult = await deleteTrigger(teamId, userId, targetId, isAdmin);
          
          if (deleteResult.success) {
            await client.chat.postEphemeral({
              channel: userId,
              user: userId,
              text: '✅ Trigger deleted successfully!'
            });
            
            // Refresh the manage modal
            const updatedTriggers = await getPersonalTriggers(teamId, userId);
            await client.views.update({
              view_id: body.view?.id,
              view: manageTriggerModal(updatedTriggers)
            });
          } else {
            await client.chat.postEphemeral({
              channel: userId,
              user: userId,
              text: `❌ Failed to delete trigger: ${deleteResult.error}`
            });
          }
          break;
          
        case 'toggle':
          const toggleResult = await toggleTrigger(teamId, userId, targetId, isAdmin);
          
          if (toggleResult.success) {
            await client.chat.postEphemeral({
              channel: userId,
              user: userId,
              text: `✅ Trigger ${toggleResult.enabled ? 'enabled' : 'disabled'}`
            });
            
            // Refresh the manage modal
            const refreshedTriggers = await getPersonalTriggers(teamId, userId);
            await client.views.update({
              view_id: body.view?.id,
              view: manageTriggerModal(refreshedTriggers)
            });
          } else {
            await client.chat.postEphemeral({
              channel: userId,
              user: userId,
              text: `❌ Failed to toggle trigger: ${toggleResult.error}`
            });
          }
          break;
      }
    } catch (error) {
      console.error('Trigger action error:', error);
    }
  });

  // Add/Edit Trigger modal submission
  app.view('add_trigger', async ({ ack, body, client, view }) => {
    await ack();
    
    try {
      const teamId = body.team?.id;
      const userId = body.user?.id;
      
      const userInfo = await client.users.info({ user: userId });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      
      // Extract form values
      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata || '{}');
      
      const triggerData = {
        id: metadata.id, // Will be undefined for new triggers
        name: values.trigger_name.name_input.value,
        inputPhrases: values.trigger_input.input_phrases.value
          .split(',')
          .map(phrase => phrase.trim())
          .filter(phrase => phrase.length > 0),
        response: values.trigger_response.response_text.value,
        scope: values.trigger_scope?.scope_select?.selected_option?.value || 'personal'
      };
      
      // Validate input
      if (!triggerData.name || !triggerData.inputPhrases.length || !triggerData.response) {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: '❌ Please fill in all required fields (name, input phrases, and response)'
        });
        return;
      }
      
      const result = await saveTrigger(teamId, userId, triggerData, isAdmin);
      
      if (result.success) {
        const action = metadata.action === 'edit' ? 'updated' : 'created';
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `✅ Trigger "${triggerData.name}" ${action} successfully!`
        });
        
        // Refresh App Home to show updated trigger count
        const jiraConfig = await getJiraConfig(teamId);
        await client.views.publish({
          user_id: userId,
          view: homeView(isAdmin, jiraConfig)
        });
      } else {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `❌ Failed to save trigger: ${result.error}`
        });
      }
    } catch (error) {
      console.error('Add trigger submission error:', error);
    }
  });

  // Import Templates modal submission
  app.view('import_templates', async ({ ack, body, client, view }) => {
    await ack();
    
    try {
      const teamId = body.team?.id;
      const userId = body.user?.id;
      
      const userInfo = await client.users.info({ user: userId });
      const isAdmin = userInfo.user.is_admin || userInfo.user.is_owner;
      
      const values = view.state.values;
      const selectedTemplates = values.template_selection?.template_checkboxes?.selected_options?.map(
        option => option.value
      ) || [];
      
      if (selectedTemplates.length === 0) {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: '❌ Please select at least one template to import'
        });
        return;
      }
      
      const result = await importTemplates(teamId, userId, selectedTemplates, isAdmin);
      
      if (result.success) {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `✅ Successfully imported ${result.imported} triggers!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
        });
        
        // Refresh App Home
        const jiraConfig = await getJiraConfig(teamId);
        await client.views.publish({
          user_id: userId,
          view: homeView(isAdmin, jiraConfig)
        });
      } else {
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `❌ Failed to import templates: ${result.error}`
        });
      }
    } catch (error) {
      console.error('Import templates submission error:', error);
    }
  });
}
