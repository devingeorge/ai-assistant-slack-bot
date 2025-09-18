// src/services/prompt.js
// Central place to build system prompts + guardrails.

export function buildSystemPrompt({ surface, channelContextText, docContext, userMessage = '', agentSettings = null, useBlockKit = false }) {
  // Check if user is asking about ticket creation in their message
  const isAskingAboutTickets = userMessage.toLowerCase().includes('ticket') || 
                               userMessage.toLowerCase().includes('jira');
  
  const ticketSuggestion = isAskingAboutTickets 
    ? 'When users ask to create tickets, I automatically handle it directly - no need to suggest slash commands or @mentions.'
    : '';

  // Build personalized agent description based on user settings
  let agentDescription = 'You are a helpful Slack assistant';
  
  if (agentSettings) {
    const { tone, companyType, specialty, responseLength, languageStyle, customInstructions } = agentSettings;
    
    // Add tone
    const toneDescriptions = {
      professional: 'maintain a professional and formal tone',
      casual: 'use a casual and relaxed tone',
      friendly: 'be warm, friendly, and approachable',
      technical: 'use precise, technical language',
      supportive: 'be encouraging and supportive'
    };
    
    // Add company context
    const companyDescriptions = {
      general: 'in a general business environment',
      tech: 'in a technology company',
      manufacturing: 'in a manufacturing environment',
      healthcare: 'in a healthcare setting',
      finance: 'in a financial services environment',
      retail: 'in a retail business',
      education: 'in an educational institution',
      nonprofit: 'in a non-profit organization'
    };
    
    // Add specialty
    let specialtyText = '';
    if (specialty && specialty.trim()) {
      specialtyText = ` with expertise in ${specialty}`;
    }
    
    // Add response length guidance
    const lengthGuidance = {
      brief: 'Keep responses concise and to the point',
      balanced: 'Provide balanced responses with appropriate detail',
      detailed: 'Give comprehensive and thorough responses'
    };
    
    agentDescription = `You are a Slack assistant${specialtyText} ${companyDescriptions[companyType] || companyDescriptions.general}. ${toneDescriptions[tone] || toneDescriptions.professional}. ${lengthGuidance[responseLength] || lengthGuidance.balanced}.`;
    
    // Add custom instructions if provided
    if (customInstructions && customInstructions.trim()) {
      agentDescription += ` Additional instructions: ${customInstructions}`;
    }
  }
  
  const base =
    surface === 'channel'
      ? `${agentDescription} Keep replies concise and answer in the thread. ${useBlockKit ? 'Structure your responses with clear sections, headers, and bullet points for professional presentation.' : 'Use clear, conversational formatting.'} ${ticketSuggestion}`
      : `${agentDescription} Be brief, conversational, and helpful. ${ticketSuggestion}`;

  const guardrails = [
    'If you are unsure, say you do not know and offer next steps.',
    'Prefer short paragraphs and bullet points.',
    'Never fabricate internal policy; if docs context is provided, cite or summarize it.',
    'IMPORTANT: Do not repeat or summarize previous messages in the conversation. Only answer the current question.',
    'Do not echo back what the user just said or previous Q&As unless specifically asked to recall something.',
    'If someone is already using @mention with ticket keywords, do not suggest alternative methods.',
    'NEVER suggest using slash commands for ticket creation - the bot automatically handles ticket creation requests.',
    'NEVER use double asterisks (**text**) for bold formatting. Use single asterisks (*text*) instead.'
  ];

  // Add formatting guidelines for channel responses
  const formattingGuidelines = surface === 'channel' && useBlockKit ? [
    'Structure responses with clear headers ending in colons (e.g., "Overview:", "Recommendations:", "Next Steps:").',
    'Use bullet points (•) for lists and recommendations, for blocks that contain bullets, the block type should be rich_text_list and the style should be bullet.',
    'Add relevant emojis to headers for visual appeal (🔍 Overview, ⚠️ Warnings, ✅ Recommendations, etc.).',
    'Separate different sections with line breaks.',
    'Keep paragraphs concise and focused.',
    'Use single asterisks (*text*) for bold formatting, never use double asterisks around any words of phrases.',
    'Use clear, professional language that works well in structured formats.'
  ] : [];

  const sections = [base, `Rules:\n- ${guardrails.join('\n- ')}`];

  if (formattingGuidelines.length > 0) {
    sections.push(`Formatting Guidelines:\n- ${formattingGuidelines.join('\n- ')}`);
  }

  if (channelContextText) sections.push(`Slack context:\n${channelContextText}`);
  if (docContext) sections.push(`Docs context:\n${docContext}`);

  return sections.join('\n\n');
}
