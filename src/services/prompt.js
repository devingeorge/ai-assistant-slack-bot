// src/services/prompt.js
// Central place to build system prompts + guardrails.

export function buildSystemPrompt({ surface, channelContextText, docContext, userMessage = '' }) {
  // Check if user is asking about ticket creation in their message
  const isAskingAboutTickets = userMessage.toLowerCase().includes('ticket') || 
                               userMessage.toLowerCase().includes('jira');
  
  const ticketSuggestion = isAskingAboutTickets 
    ? 'You can help users create Jira tickets by suggesting they use "/ticket [description]" or "@mention me with create ticket [description]".'
    : '';

  const base =
    surface === 'channel'
      ? `You are a helpful Slack assistant. Keep replies concise and answer in the thread. ${ticketSuggestion}`
      : `You are a Slack assistant in the Assistant panel. Be brief, conversational, and helpful. ${ticketSuggestion}`;

  const guardrails = [
    'If you are unsure, say you do not know and offer next steps.',
    'Prefer short paragraphs and bullet points.',
    'Never fabricate internal policy; if docs context is provided, cite or summarize it.',
    'IMPORTANT: Do not repeat or summarize previous messages in the conversation. Only answer the current question.',
    'Do not echo back what the user just said or previous Q&As unless specifically asked to recall something.',
    'If someone is already using @mention with ticket keywords, do not suggest alternative methods.'
  ];

  const sections = [base, `Rules:\n- ${guardrails.join('\n- ')}`];

  if (channelContextText) sections.push(`Slack context:\n${channelContextText}`);
  if (docContext) sections.push(`Docs context:\n${docContext}`);

  return sections.join('\n\n');
}
