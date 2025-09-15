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

/** App Home with a clear cached history button */
export function homeView() {
  return {
    type: 'home',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Your Slack LLM Assistant', emoji: true }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            'Welcome! Use the *Chat* tab or the *AI Assistant* panel to talk to me.\n\n' +
            'Use the button below to clear my cached memory for your account.'
        },
        accessory: {
          type: 'button',
          action_id: 'reset_memory',
          text: { type: 'plain_text', text: '🧹 Clear cached history' },
          style: 'primary',
          value: 'reset'
        }
      },
      { type: 'divider' },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text:
              'Clearing cached history deletes your saved conversation turns and assistant context in Redis. ' +
              'It does *not* delete Slack messages.'
          }
        ]
      }
    ]
  };
}
