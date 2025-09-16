// src/ui/views.js

/** Ephemeral "Stop" button used in channels while generating */
export const stopBlocks = [
  {
    type: 'section',
    text: { type: 'mrkdwn', text: 'Generating…' }
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Stop' },
        action_id: 'stop_generation',
        style: 'danger'
      }
    ]
  }
];

/** App Home with admin controls and integrations */
export function homeView(isAdmin = false, jiraConfig = null) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🤖 AI Assistant', emoji: true }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Welcome! Use the *Chat* tab or the *AI Assistant* panel to talk to me.'
      }
    }
  ];

  // Add Jira integration section (admin only)
  if (isAdmin) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '⚙️ Workspace Settings', emoji: true }
    });
    
    const jiraStatus = jiraConfig 
      ? `✅ Connected to ${jiraConfig.baseUrl}\nDefault project: *${jiraConfig.defaultProject}*`
      : '○ Not configured';
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Jira Integration*\n${jiraStatus}`
      },
      accessory: {
        type: 'button',
        action_id: jiraConfig ? 'update_jira' : 'setup_jira',
        text: { 
          type: 'plain_text', 
          text: jiraConfig ? '⚙️ Update' : '🔗 Set up Jira'
        },
        style: jiraConfig ? 'primary' : 'primary'
      }
    });
  }

  // Add user controls
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Personal Settings*\nClear your conversation history with the bot.'
    },
    accessory: {
      type: 'button',
      action_id: 'reset_memory',
      text: { type: 'plain_text', text: '🧹 Clear history' },
      style: 'danger',
      value: 'reset'
    }
  });

  return { type: 'home', blocks };
}

/** Jira setup modal */
export function jiraSetupModal(existingConfig = null) {
  const title = existingConfig ? 'Update Jira Integration' : 'Set up Jira Integration';
  
  return {
    type: 'modal',
    callback_id: 'jira_setup',
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🔗 Connect your workspace to Jira to create tickets from conversations.'
        }
      },
      {
        type: 'input',
        block_id: 'jira_url',
        label: { type: 'plain_text', text: 'Jira URL' },
        element: {
          type: 'plain_text_input',
          action_id: 'url_input',
          placeholder: { type: 'plain_text', text: 'https://company.atlassian.net' },
          initial_value: existingConfig?.baseUrl || ''
        }
      },
      {
        type: 'input',
        block_id: 'jira_email',
        label: { type: 'plain_text', text: 'Jira Email' },
        element: {
          type: 'plain_text_input',
          action_id: 'email_input',
          placeholder: { type: 'plain_text', text: 'bot@company.com' },
          initial_value: existingConfig?.email || ''
        }
      },
      {
        type: 'input',
        block_id: 'jira_token',
        label: { type: 'plain_text', text: 'API Token' },
        element: {
          type: 'plain_text_input',
          action_id: 'token_input',
          placeholder: { type: 'plain_text', text: 'ATATT3xFfGF0...' },
          initial_value: existingConfig?.apiToken || ''
        },
        hint: { type: 'plain_text', text: 'Create at: Account Settings → Security → API tokens' }
      },
      {
        type: 'input',
        block_id: 'jira_project',
        label: { type: 'plain_text', text: 'Default Project Key' },
        element: {
          type: 'plain_text_input',
          action_id: 'project_input',
          placeholder: { type: 'plain_text', text: 'SUPPORT' },
          initial_value: existingConfig?.defaultProject || ''
        }
      },
      {
        type: 'input',
        block_id: 'jira_issue_type',
        label: { type: 'plain_text', text: 'Default Issue Type' },
        element: {
          type: 'plain_text_input',
          action_id: 'issue_type_input',
          placeholder: { type: 'plain_text', text: 'Task' },
          initial_value: existingConfig?.defaultIssueType || 'Task'
        },
        optional: true
      }
    ]
  };
}
