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
        text: 'Welcome! Here are the ways to interact with me:\n\n• *Messages tab* above - Direct message me here\n• *@mention* me in any channel for context-aware help\n• *AI Assistant panel* - Use the ⚡ icon in Slack for smart assistance\n• */ask* and */ticket* slash commands'
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

  // Add Dynamic Action Triggers section
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '⚡ Quick Actions', emoji: true }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Dynamic Action Triggers*\nCreate custom responses that bypass the AI for common questions.'
    }
  });
  
  // Action buttons row
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'add_trigger',
        text: { type: 'plain_text', text: '➕ Add Trigger' },
        style: 'primary'
      },
      {
        type: 'button',
        action_id: 'manage_triggers',
        text: { type: 'plain_text', text: '📝 Manage Triggers' }
      },
      {
        type: 'button',
        action_id: 'import_templates',
        text: { type: 'plain_text', text: '📋 Import Templates' }
      }
    ]
  });

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

/** Add/Edit Trigger Modal */
export function addTriggerModal(existingTrigger = null) {
  const title = existingTrigger ? 'Edit Action Trigger' : 'Add Action Trigger';
  
  return {
    type: 'modal',
    callback_id: 'add_trigger',
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚡ Create a custom trigger that responds instantly without using AI.\n*Examples:* FAQ responses, contact info, quick links, etc.'
        }
      },
      {
        type: 'input',
        block_id: 'trigger_name',
        label: { type: 'plain_text', text: 'Trigger Name' },
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: { type: 'plain_text', text: 'e.g., "Office Hours Info"' },
          initial_value: existingTrigger?.name || ''
        },
        hint: { type: 'plain_text', text: 'A descriptive name for this trigger' }
      },
      {
        type: 'input',
        block_id: 'trigger_input',
        label: { type: 'plain_text', text: 'Input Phrases' },
        element: {
          type: 'plain_text_input',
          action_id: 'input_phrases',
          placeholder: { type: 'plain_text', text: 'office hours, what time, when are you open' },
          initial_value: existingTrigger?.inputPhrases?.join(', ') || ''
        },
        hint: { type: 'plain_text', text: 'Comma-separated phrases that trigger this response (case-insensitive)' }
      },
      {
        type: 'input',
        block_id: 'trigger_response',
        label: { type: 'plain_text', text: 'Response' },
        element: {
          type: 'plain_text_input',
          action_id: 'response_text',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'Our office hours are Monday-Friday, 9 AM to 5 PM EST.' },
          initial_value: existingTrigger?.response || ''
        }
      },
      {
        type: 'input',
        block_id: 'trigger_scope',
        label: { type: 'plain_text', text: 'Scope' },
        element: {
          type: 'static_select',
          action_id: 'scope_select',
          placeholder: { type: 'plain_text', text: 'Select scope' },
          initial_option: existingTrigger ? {
            text: { type: 'plain_text', text: existingTrigger.scope === 'workspace' ? 'Workspace-wide' : 'Personal only' },
            value: existingTrigger.scope
          } : undefined,
          options: [
            {
              text: { type: 'plain_text', text: 'Personal only' },
              value: 'personal'
            },
            {
              text: { type: 'plain_text', text: 'Workspace-wide (Admin only)' },
              value: 'workspace'
            }
          ]
        },
        optional: true
      }
    ],
    private_metadata: existingTrigger ? JSON.stringify({ id: existingTrigger.id, action: 'edit' }) : JSON.stringify({ action: 'create' })
  };
}

/** Manage Triggers Modal */
export function manageTriggerModal(triggers = []) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📝 *Manage Your Action Triggers*\nView, edit, or delete your custom responses.'
      }
    }
  ];

  if (triggers.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No triggers created yet. Click "Add Trigger" to get started!_'
      }
    });
  } else {
    blocks.push({ type: 'divider' });
    
    triggers.forEach((trigger, index) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${trigger.name}*\n` +
                `_Triggers:_ ${trigger.inputPhrases.slice(0, 3).join(', ')}${trigger.inputPhrases.length > 3 ? '...' : ''}\n` +
                `_Response:_ ${trigger.response.slice(0, 100)}${trigger.response.length > 100 ? '...' : ''}\n` +
                `_Scope:_ ${trigger.scope === 'workspace' ? '🌐 Workspace' : '👤 Personal'}`
        },
        accessory: {
          type: 'overflow',
          action_id: `trigger_actions_${trigger.id}`,
          options: [
            {
              text: { type: 'plain_text', text: '✏️ Edit' },
              value: `edit_${trigger.id}`
            },
            {
              text: { type: 'plain_text', text: '🗑️ Delete' },
              value: `delete_${trigger.id}`
            },
            {
              text: { type: 'plain_text', text: '🔄 Toggle Enabled' },
              value: `toggle_${trigger.id}`
            }
          ]
        }
      });
      
      if (index < triggers.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });
  }

  return {
    type: 'modal',
    callback_id: 'manage_triggers',
    title: { type: 'plain_text', text: 'Manage Triggers' },
    close: { type: 'plain_text', text: 'Close' },
    blocks
  };
}

/** Import Templates Modal */
export function importTemplatesModal() {
  return {
    type: 'modal',
    callback_id: 'import_templates',
    title: { type: 'plain_text', text: 'Import Templates' },
    submit: { type: 'plain_text', text: 'Import Selected' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📋 *Quick Start Templates*\nChoose from pre-built triggers to get started quickly.'
        }
      },
      {
        type: 'input',
        block_id: 'template_selection',
        label: { type: 'plain_text', text: 'Select Templates' },
        element: {
          type: 'checkboxes',
          action_id: 'template_checkboxes',
          options: [
            {
              text: { type: 'plain_text', text: 'Office Hours & Contact Info' },
              value: 'office_hours',
              description: { type: 'plain_text', text: 'Standard business hours and contact information' }
            },
            {
              text: { type: 'plain_text', text: 'Common IT Support' },
              value: 'it_support',
              description: { type: 'plain_text', text: 'Password resets, WiFi info, basic troubleshooting' }
            },
            {
              text: { type: 'plain_text', text: 'Company Policies' },
              value: 'policies',
              description: { type: 'plain_text', text: 'PTO, expense reports, code of conduct links' }
            },
            {
              text: { type: 'plain_text', text: 'Meeting Room Info' },
              value: 'meeting_rooms',
              description: { type: 'plain_text', text: 'Room booking, AV setup, capacity info' }
            },
            {
              text: { type: 'plain_text', text: 'Development Resources' },
              value: 'dev_resources',
              description: { type: 'plain_text', text: 'Code repos, deployment guides, style guides' }
            }
          ]
        }
      }
    ]
  };
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
