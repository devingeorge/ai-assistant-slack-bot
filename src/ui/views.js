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
export function homeView(isAdmin = false, jiraConfig = null, agentSettings = null) {
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

  // Add Agent Settings section
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '🤖 Agent Settings', emoji: true }
  });
  
  // Show current agent settings
  if (agentSettings) {
    const { tone, companyType, specialty, responseLength } = agentSettings;
    
    const toneLabels = {
      professional: 'Professional',
      casual: 'Casual', 
      friendly: 'Friendly',
      technical: 'Technical',
      supportive: 'Supportive'
    };
    
    const companyLabels = {
      general: 'General Business',
      tech: 'Technology',
      manufacturing: 'Manufacturing',
      healthcare: 'Healthcare',
      finance: 'Finance',
      retail: 'Retail',
      education: 'Education',
      nonprofit: 'Non-Profit'
    };
    
    const lengthLabels = {
      brief: 'Brief',
      balanced: 'Balanced',
      detailed: 'Detailed'
    };
    
    let settingsText = `🎯 *Current Agent Configuration*\n\n`;
    settingsText += `🔸 *Tone:* ${toneLabels[tone] || 'Professional'}\n`;
    settingsText += `🏢 *Company Type:* ${companyLabels[companyType] || 'General Business'}\n`;
    settingsText += `📏 *Response Length:* ${lengthLabels[responseLength] || 'Balanced'}\n`;
    if (specialty && specialty.trim()) {
      settingsText += `🎯 *Specialty:* ${specialty}\n`;
    }
    
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: settingsText
      },
      accessory: {
        type: 'button',
        action_id: 'configure_agent',
        text: { type: 'plain_text', text: '⚙️ Configure Agent' },
        style: 'primary'
      }
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '🎯 *Customize Your AI Assistant*\n\nSet tone, company type, specialty, and response style to personalize your experience.\n\n*Default Settings:* Professional tone, General Business, Balanced responses'
      },
      accessory: {
        type: 'button',
        action_id: 'configure_agent',
        text: { type: 'plain_text', text: '⚙️ Configure Agent' },
        style: 'primary'
      }
    });
  }

  // Add Suggested Prompts section
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '💬 Suggested Prompts', emoji: true }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Custom Assistant Prompts*\nDefine 2-3 quick prompts that appear as buttons in the Assistant panel. Perfect for frequently asked questions or common requests.'
    }
  });
  
  // Suggested prompts action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'add_suggested_prompt',
        text: { type: 'plain_text', text: '➕ Add Prompt' },
        style: 'primary'
      },
      {
        type: 'button',
        action_id: 'manage_suggested_prompts',
        text: { type: 'plain_text', text: '📝 Manage Prompts' }
      }
    ]
  });

  // Add Monitored Channels section
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '📡 Auto-Response Channels', emoji: true }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Channel Auto-Monitoring*\nMonitor up to 5 channels for automatic thread responses. Bot will analyze messages and respond in threads based on your selected response type.'
    }
  });
  
  // Monitored channels action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'add_monitored_channel',
        text: { type: 'plain_text', text: '➕ Add Channel' },
        style: 'primary'
      },
      {
        type: 'button',
        action_id: 'manage_monitored_channels',
        text: { type: 'plain_text', text: '📝 Manage Channels' }
      }
    ]
  });

  // Add Knowledge Sources section
  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: '📚 Knowledge Sources', emoji: true }
  });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*URL Knowledge Base*\nAdd URLs that the AI can crawl and use to answer your questions. Content is indexed and made searchable through RAG.'
    }
  });
  
  // Knowledge sources action buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        action_id: 'add_knowledge_url',
        text: { type: 'plain_text', text: '➕ Add URL' },
        style: 'primary'
      },
      {
        type: 'button',
        action_id: 'manage_knowledge_urls',
        text: { type: 'plain_text', text: '📝 Manage URLs' }
      }
    ]
  });

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
      const isDisabled = trigger.enabled === false;
      const statusIcon = isDisabled ? '🔴' : '🟢';
      const statusText = isDisabled ? ' (DISABLED)' : '';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusIcon} *${trigger.name}*${statusText}\n` +
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
              text: { type: 'plain_text', text: isDisabled ? '✅ Enable' : '❌ Disable' },
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

/** Agent Settings Modal */
export function agentSettingsModal(currentSettings = null) {
  const toneOptions = [
    { text: { type: 'plain_text', text: 'Professional' }, value: 'professional' },
    { text: { type: 'plain_text', text: 'Casual' }, value: 'casual' },
    { text: { type: 'plain_text', text: 'Friendly' }, value: 'friendly' },
    { text: { type: 'plain_text', text: 'Technical' }, value: 'technical' },
    { text: { type: 'plain_text', text: 'Supportive' }, value: 'supportive' }
  ];
  
  const companyTypeOptions = [
    { text: { type: 'plain_text', text: 'General Business' }, value: 'general' },
    { text: { type: 'plain_text', text: 'Technology' }, value: 'tech' },
    { text: { type: 'plain_text', text: 'Manufacturing' }, value: 'manufacturing' },
    { text: { type: 'plain_text', text: 'Healthcare' }, value: 'healthcare' },
    { text: { type: 'plain_text', text: 'Finance' }, value: 'finance' },
    { text: { type: 'plain_text', text: 'Retail' }, value: 'retail' },
    { text: { type: 'plain_text', text: 'Education' }, value: 'education' },
    { text: { type: 'plain_text', text: 'Non-Profit' }, value: 'nonprofit' }
  ];
  
  const responseLengthOptions = [
    { text: { type: 'plain_text', text: 'Brief' }, value: 'brief' },
    { text: { type: 'plain_text', text: 'Balanced' }, value: 'balanced' },
    { text: { type: 'plain_text', text: 'Detailed' }, value: 'detailed' }
  ];
  
  const languageStyleOptions = [
    { text: { type: 'plain_text', text: 'Conversational' }, value: 'conversational' },
    { text: { type: 'plain_text', text: 'Formal' }, value: 'formal' },
    { text: { type: 'plain_text', text: 'Technical' }, value: 'technical' }
  ];

  return {
    type: 'modal',
    callback_id: 'agent_settings',
    title: { type: 'plain_text', text: 'Configure Agent' },
    submit: { type: 'plain_text', text: 'Save Settings' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '⚙️ *Customize Your AI Assistant*\nPersonalize how the AI responds to match your needs and preferences.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'reset_agent_settings_from_modal',
            text: { type: 'plain_text', text: '🔄 Reset to Defaults' },
            style: 'danger',
            confirm: {
              title: { type: 'plain_text', text: 'Reset Agent Settings?' },
              text: { type: 'plain_text', text: 'This will clear all your custom agent settings and restore default behavior. This action cannot be undone.' },
              confirm: { type: 'plain_text', text: 'Yes, Reset' },
              deny: { type: 'plain_text', text: 'Cancel' }
            }
          }
        ]
      },
      {
        type: 'input',
        block_id: 'tone_setting',
        label: { type: 'plain_text', text: 'Tone' },
        element: {
          type: 'static_select',
          action_id: 'tone_select',
          placeholder: { type: 'plain_text', text: 'Select tone...' },
          options: toneOptions,
          initial_option: toneOptions.find(opt => opt.value === (currentSettings?.tone || 'professional'))
        },
        hint: { type: 'plain_text', text: 'How the AI should communicate' }
      },
      {
        type: 'input',
        block_id: 'company_type_setting',
        label: { type: 'plain_text', text: 'Company Type' },
        element: {
          type: 'static_select',
          action_id: 'company_type_select',
          placeholder: { type: 'plain_text', text: 'Select company type...' },
          options: companyTypeOptions,
          initial_option: companyTypeOptions.find(opt => opt.value === (currentSettings?.companyType || 'general'))
        },
        hint: { type: 'plain_text', text: 'Your industry or business type' }
      },
      {
        type: 'input',
        block_id: 'specialty_setting',
        label: { type: 'plain_text', text: 'Agent Specialty (Optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'specialty_input',
          placeholder: { type: 'plain_text', text: 'e.g., "reviewing factory floor incidents"' },
          initial_value: currentSettings?.specialty || '',
          multiline: false
        },
        hint: { type: 'plain_text', text: 'Specific area of expertise for the AI' },
        optional: true
      },
      {
        type: 'input',
        block_id: 'response_length_setting',
        label: { type: 'plain_text', text: 'Response Length' },
        element: {
          type: 'static_select',
          action_id: 'response_length_select',
          placeholder: { type: 'plain_text', text: 'Select response length...' },
          options: responseLengthOptions,
          initial_option: responseLengthOptions.find(opt => opt.value === (currentSettings?.responseLength || 'balanced'))
        },
        hint: { type: 'plain_text', text: 'How detailed responses should be' }
      },
      {
        type: 'input',
        block_id: 'language_style_setting',
        label: { type: 'plain_text', text: 'Language Style' },
        element: {
          type: 'static_select',
          action_id: 'language_style_select',
          placeholder: { type: 'plain_text', text: 'Select language style...' },
          options: languageStyleOptions,
          initial_option: languageStyleOptions.find(opt => opt.value === (currentSettings?.languageStyle || 'conversational'))
        },
        hint: { type: 'plain_text', text: 'Formality and structure of responses' }
      },
      {
        type: 'input',
        block_id: 'custom_instructions_setting',
        label: { type: 'plain_text', text: 'Custom Instructions (Optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'custom_instructions_input',
          placeholder: { type: 'plain_text', text: 'Any additional instructions for the AI...' },
          initial_value: currentSettings?.customInstructions || '',
          multiline: true
        },
        hint: { type: 'plain_text', text: 'Additional guidance for the AI behavior' },
        optional: true
      },
      {
        type: 'input',
        block_id: 'canvas_setting',
        label: { type: 'plain_text', text: 'Auto-Create Canvas' },
        element: {
          type: 'checkboxes',
          action_id: 'canvas_checkbox',
          options: [
            {
              text: { type: 'plain_text', text: 'Automatically create Slack Canvas for responses' },
              value: 'enabled'
            }
          ]
        },
        hint: { type: 'plain_text', text: 'Create rich Canvas documents for AI responses' },
        optional: true
      }
    ]
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

/** Add/Edit Suggested Prompt Modal */
export function addSuggestedPromptModal(existingPrompt = null) {
  const title = existingPrompt ? 'Edit Suggested Prompt' : 'Add Suggested Prompt';
  
  return {
    type: 'modal',
    callback_id: 'add_suggested_prompt',
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '💬 Create a custom prompt button that appears in the Assistant panel.\n*The prompt text will be sent as a message when the button is clicked.*'
        }
      },
      {
        type: 'input',
        block_id: 'prompt_name',
        label: { type: 'plain_text', text: 'Prompt Name (Button Text)' },
        element: {
          type: 'plain_text_input',
          action_id: 'name_input',
          placeholder: { type: 'plain_text', text: 'e.g., "Summarize this channel"' },
          initial_value: existingPrompt?.name || '',
          max_length: 75
        },
        hint: { type: 'plain_text', text: 'Short name that appears on the button (max 75 characters)' }
      },
      {
        type: 'input',
        block_id: 'prompt_text',
        label: { type: 'plain_text', text: 'Prompt Message' },
        element: {
          type: 'plain_text_input',
          action_id: 'prompt_input',
          multiline: true,
          placeholder: { type: 'plain_text', text: 'e.g., "Please summarize the key points from this channel conversation"' },
          initial_value: existingPrompt?.prompt || '',
          max_length: 2000
        },
        hint: { type: 'plain_text', text: 'The message that will be sent to the assistant when clicked (max 2000 characters)' }
      },
      {
        type: 'input',
        block_id: 'prompt_description',
        label: { type: 'plain_text', text: 'Description (Optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'description_input',
          placeholder: { type: 'plain_text', text: 'Brief description of what this prompt does' },
          initial_value: existingPrompt?.description || '',
          max_length: 100
        },
        hint: { type: 'plain_text', text: 'Optional description to help you remember what this prompt is for' },
        optional: true
      }
    ],
    private_metadata: existingPrompt ? JSON.stringify({ id: existingPrompt.id, action: 'edit' }) : JSON.stringify({ action: 'create' })
  };
}

/** Manage Suggested Prompts Modal */
export function manageSuggestedPromptsModal(prompts = []) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '💬 *Manage Your Suggested Prompts*\nView, edit, or delete your custom Assistant panel prompts.\n\n*Note: You can have up to 3 suggested prompts.*'
      }
    }
  ];

  if (prompts.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '_No suggested prompts created yet. Click "Add Prompt" to get started!_'
      }
    });
  } else {
    blocks.push({ type: 'divider' });
    
    prompts.forEach((prompt, index) => {
      const isDisabled = prompt.enabled === false;
      const statusIcon = isDisabled ? '🔴' : '🟢';
      const statusText = isDisabled ? ' (DISABLED)' : '';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusIcon} *${prompt.name}*${statusText}\n` +
                `_Prompt:_ ${prompt.prompt.slice(0, 80)}${prompt.prompt.length > 80 ? '...' : ''}\n` +
                `_Created:_ ${new Date(prompt.createdAt).toLocaleDateString()}`
        },
        accessory: {
          type: 'overflow',
          action_id: `suggested_prompt_actions_${prompt.id}`,
          options: [
            {
              text: { type: 'plain_text', text: '✏️ Edit' },
              value: `edit_${prompt.id}`
            },
            {
              text: { type: 'plain_text', text: '🗑️ Delete' },
              value: `delete_${prompt.id}`
            },
            {
              text: { type: 'plain_text', text: isDisabled ? '✅ Enable' : '❌ Disable' },
              value: `toggle_${prompt.id}`
            }
          ]
        }
      });
      
      if (index < prompts.length - 1) {
        blocks.push({ type: 'divider' });
      }
    });
  }

  return {
    type: 'modal',
    callback_id: 'manage_suggested_prompts',
    title: { type: 'plain_text', text: 'Manage Suggested Prompts' },
    close: { type: 'plain_text', text: 'Close' },
    blocks
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

export function addMonitoredChannelModal() {
  return {
    type: 'modal',
    callback_id: 'add_monitored_channel',
    title: { type: 'plain_text', text: 'Add Monitored Channel' },
    submit: { type: 'plain_text', text: 'Add Channel' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📡 *Add Channel for Auto-Monitoring*\nThe bot will automatically respond to messages in this channel via thread replies.'
        }
      },
      {
        type: 'input',
        block_id: 'channel_select',
        label: { type: 'plain_text', text: 'Select Channel' },
        element: {
          type: 'channels_select',
          action_id: 'channel_input',
          placeholder: { type: 'plain_text', text: 'Choose a channel to monitor...' }
        },
        hint: { type: 'plain_text', text: 'Select the channel where you want auto-responses' }
      },
      {
        type: 'input',
        block_id: 'response_type',
        label: { type: 'plain_text', text: 'Response Type' },
        element: {
          type: 'static_select',
          action_id: 'response_type_input',
          placeholder: { type: 'plain_text', text: 'Choose response type...' },
          options: [
            {
              text: { type: 'plain_text', text: 'Analytical - Analyze messages for insights and patterns' },
              value: 'analytical'
            },
            {
              text: { type: 'plain_text', text: 'Summary - Provide concise summaries of activity' },
              value: 'summary'
            },
            {
              text: { type: 'plain_text', text: 'Questions - Ask clarifying questions to facilitate discussion' },
              value: 'questions'
            },
            {
              text: { type: 'plain_text', text: 'Insights - Share observations and actionable insights' },
              value: 'insights'
            }
          ]
        },
        hint: { type: 'plain_text', text: 'How should the bot respond to messages in this channel?' }
      },
      {
        type: 'input',
        block_id: 'auto_jira_tickets',
        label: { type: 'plain_text', text: 'Auto-Create Jira Tickets' },
        element: {
          type: 'checkboxes',
          action_id: 'auto_jira_input',
          options: [
            {
              text: { type: 'plain_text', text: 'Create Jira ticket after 1st bot response in thread' },
              value: 'enabled'
            }
          ]
        },
        hint: { type: 'plain_text', text: 'Automatically creates a Jira ticket to track ongoing discussions' },
        optional: true
      }
    ]
  };
}

export function manageMonitoredChannelsModal(channels) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📡 *Manage Monitored Channels*\nEdit, enable/disable, or remove auto-response channels.'
      }
    }
  ];

  if (channels.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No channels are being monitored yet.'
      }
    });
  } else {
    channels.forEach(channel => {
      const statusEmoji = channel.enabled ? '✅' : '❌';
      const statusText = channel.enabled ? 'Enabled' : 'Disabled';
      const responseTypeLabels = {
        analytical: 'Analytical',
        summary: 'Summary', 
        questions: 'Questions',
        insights: 'Insights'
      };
      
      const jiraStatus = channel.autoCreateJiraTickets ? '🎫 Auto-Jira: On' : '🎫 Auto-Jira: Off';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji} *#${channel.channelName}*\nResponse Type: ${responseTypeLabels[channel.responseType] || channel.responseType}\n${jiraStatus}\n_${statusText}_`
        },
        accessory: {
          type: 'overflow',
          options: [
            {
              text: { type: 'plain_text', text: '✏️ Edit Settings' },
              value: `edit_${channel.channelId}`
            },
            {
              text: { type: 'plain_text', text: channel.enabled ? '🔴 Disable' : '🟢 Enable' },
              value: `toggle_${channel.channelId}`
            },
            {
              text: { type: 'plain_text', text: '🗑️ Remove' },
              value: `remove_${channel.channelId}`
            }
          ],
          action_id: `monitored_channel_actions_${channel.channelId}`
        }
      });
    });
  }

  return {
    type: 'modal',
    callback_id: 'manage_monitored_channels',
    title: { type: 'plain_text', text: 'Manage Channels' },
    close: { type: 'plain_text', text: 'Close' },
    blocks
  };
}

export function editMonitoredChannelModal(channel) {
  const responseTypeLabels = {
    analytical: 'Analytical',
    summary: 'Summary', 
    questions: 'Questions',
    insights: 'Insights'
  };

  return {
    type: 'modal',
    callback_id: 'edit_monitored_channel',
    title: { type: 'plain_text', text: 'Edit Channel' },
    submit: { type: 'plain_text', text: 'Save Changes' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ channelId: channel.channelId }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✏️ *Edit Settings for #${channel.channelName}*`
        }
      },
      {
        type: 'input',
        block_id: 'response_type',
        label: { type: 'plain_text', text: 'Response Type' },
        element: {
          type: 'static_select',
          action_id: 'response_type_input',
          placeholder: { type: 'plain_text', text: 'Choose response type...' },
          initial_option: {
            text: { type: 'plain_text', text: `${responseTypeLabels[channel.responseType]} - ${getResponseTypeDescription(channel.responseType)}` },
            value: channel.responseType
          },
          options: [
            {
              text: { type: 'plain_text', text: 'Analytical - Analyze messages for insights and patterns' },
              value: 'analytical'
            },
            {
              text: { type: 'plain_text', text: 'Summary - Provide concise summaries of activity' },
              value: 'summary'
            },
            {
              text: { type: 'plain_text', text: 'Questions - Ask clarifying questions to facilitate discussion' },
              value: 'questions'
            },
            {
              text: { type: 'plain_text', text: 'Insights - Share observations and actionable insights' },
              value: 'insights'
            }
          ]
        },
        hint: { type: 'plain_text', text: 'How should the bot respond to messages in this channel?' }
      },
      {
        type: 'input',
        block_id: 'auto_jira_tickets',
        label: { type: 'plain_text', text: 'Auto-Create Jira Tickets' },
        element: {
          type: 'checkboxes',
          action_id: 'auto_jira_input',
          initial_options: channel.autoCreateJiraTickets ? [
            {
              text: { type: 'plain_text', text: 'Create Jira ticket after 1st bot response in thread' },
              value: 'enabled'
            }
          ] : [],
          options: [
            {
              text: { type: 'plain_text', text: 'Create Jira ticket after 1st bot response in thread' },
              value: 'enabled'
            }
          ]
        },
        hint: { type: 'plain_text', text: 'Automatically creates a Jira ticket to track ongoing discussions' },
        optional: true
      }
    ]
  };
}

function getResponseTypeDescription(responseType) {
  const descriptions = {
    analytical: 'Analyze messages for insights and patterns',
    summary: 'Provide concise summaries of activity',
    questions: 'Ask clarifying questions to facilitate discussion',
    insights: 'Share observations and actionable insights'
  };
  return descriptions[responseType] || 'Unknown response type';
}

export function addKnowledgeUrlModal() {
  return {
    type: 'modal',
    callback_id: 'add_knowledge_url',
    title: { type: 'plain_text', text: 'Add Knowledge URL' },
    submit: { type: 'plain_text', text: 'Add URL' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '📚 *Add URL to Knowledge Base*\nThe AI will crawl this URL and make its content available for answering questions.'
        }
      },
      {
        type: 'input',
        block_id: 'url_input',
        label: { type: 'plain_text', text: 'URL' },
        element: {
          type: 'url_text_input',
          action_id: 'url_field',
          placeholder: { type: 'plain_text', text: 'https://example.com/documentation' }
        },
        hint: { type: 'plain_text', text: 'Enter the URL you want to add to your knowledge base' }
      },
      {
        type: 'input',
        block_id: 'title_input',
        label: { type: 'plain_text', text: 'Title (Optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'title_field',
          placeholder: { type: 'plain_text', text: 'Custom title for this URL' },
          max_length: 100
        },
        hint: { type: 'plain_text', text: 'Give this URL a custom title (defaults to URL if empty)' },
        optional: true
      },
      {
        type: 'input',
        block_id: 'description_input',
        label: { type: 'plain_text', text: 'Description (Optional)' },
        element: {
          type: 'plain_text_input',
          action_id: 'description_field',
          placeholder: { type: 'plain_text', text: 'Brief description of what this URL contains' },
          max_length: 200,
          multiline: true
        },
        hint: { type: 'plain_text', text: 'Describe what content this URL contains' },
        optional: true
      }
    ]
  };
}

export function manageKnowledgeUrlsModal(urls) {
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📚 *Manage Knowledge Sources*\nEdit, enable/disable, or remove URLs from your knowledge base.'
      }
    }
  ];

  if (urls.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'No URLs added to your knowledge base yet.'
      }
    });
  } else {
    urls.forEach(url => {
      const statusEmoji = url.enabled ? '✅' : '❌';
      const statusText = url.enabled ? 'Enabled' : 'Disabled';
      const crawlStatusEmoji = {
        pending: '⏳',
        crawling: '🔄',
        completed: '✅',
        failed: '❌'
      }[url.crawlStatus] || '❓';
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${statusEmoji} *${url.title}*\n${url.description ? url.description + '\n' : ''}<${url.url}|View URL>\n${crawlStatusEmoji} Crawl: ${url.crawlStatus}\n_${statusText}_`
        },
        accessory: {
          type: 'overflow',
          options: [
            {
              text: { type: 'plain_text', text: '✏️ Edit' },
              value: `edit_${url.id}`
            },
            {
              text: { type: 'plain_text', text: url.enabled ? '🔴 Disable' : '🟢 Enable' },
              value: `toggle_${url.id}`
            },
            {
              text: { type: 'plain_text', text: '🗑️ Remove' },
              value: `remove_${url.id}`
            }
          ],
          action_id: `knowledge_url_actions_${url.id}`
        }
      });
    });

    // Add clear all button if there are URLs
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          action_id: 'clear_all_knowledge_urls',
          text: { type: 'plain_text', text: '🗑️ Clear All URLs' },
          style: 'danger',
          confirm: {
            title: { type: 'plain_text', text: 'Clear All URLs' },
            text: { type: 'plain_text', text: 'Are you sure you want to remove all URLs from your knowledge base? This action cannot be undone.' },
            confirm: { type: 'plain_text', text: 'Yes, Clear All' },
            deny: { type: 'plain_text', text: 'Cancel' }
          }
        }
      ]
    });
  }

  return {
    type: 'modal',
    callback_id: 'manage_knowledge_urls',
    title: { type: 'plain_text', text: 'Manage URLs' },
    close: { type: 'plain_text', text: 'Close' },
    blocks
  };
}

export function editKnowledgeUrlModal(url) {
  return {
    type: 'modal',
    callback_id: 'edit_knowledge_url',
    title: { type: 'plain_text', text: 'Edit URL' },
    submit: { type: 'plain_text', text: 'Save Changes' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: JSON.stringify({ urlId: url.id }),
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✏️ *Edit Knowledge Source*\n<${url.url}|${url.title}>`
        }
      },
      {
        type: 'input',
        block_id: 'title_input',
        label: { type: 'plain_text', text: 'Title' },
        element: {
          type: 'plain_text_input',
          action_id: 'title_field',
          placeholder: { type: 'plain_text', text: 'Custom title for this URL' },
          initial_value: url.title,
          max_length: 100
        }
      },
      {
        type: 'input',
        block_id: 'description_input',
        label: { type: 'plain_text', text: 'Description' },
        element: {
          type: 'plain_text_input',
          action_id: 'description_field',
          placeholder: { type: 'plain_text', text: 'Brief description of what this URL contains' },
          initial_value: url.description || '',
          max_length: 200,
          multiline: true
        },
        optional: true
      }
    ]
  };
}
