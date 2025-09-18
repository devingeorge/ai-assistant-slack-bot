// src/services/assistantPanel.js
import { getSuggestedPrompts } from './suggestedPrompts.js';
import { logger } from '../lib/logger.js';

/** Generate suggested prompt buttons for the assistant panel */
export async function getSuggestedPromptButtons(teamId, userId) {
  try {
    const prompts = await getSuggestedPrompts(teamId, userId);
    
    if (prompts.length === 0) {
      return null;
    }
    
    // Create button blocks for each suggested prompt
    const buttonElements = prompts.map(prompt => ({
      type: 'button',
      text: { 
        type: 'plain_text', 
        text: prompt.name,
        emoji: true
      },
      action_id: `suggested_prompt_${prompt.id}`,
      style: 'primary'
    }));
    
    // Return blocks that can be added to assistant panel messages
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*💬 Suggested Prompts:*'
        }
      },
      {
        type: 'actions',
        elements: buttonElements
      }
    ];
  } catch (error) {
    logger.error('Error getting suggested prompt buttons:', error);
    return null;
  }
}

/** Check if we should show suggested prompts in a specific context */
export function shouldShowSuggestedPrompts(context) {
  // Show suggested prompts in DM conversations with the bot
  // but not in channel mentions or slash commands
  return context?.isDM === true;
}
