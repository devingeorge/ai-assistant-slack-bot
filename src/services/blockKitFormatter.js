// src/services/blockKitFormatter.js
// Converts AI responses into structured Slack Block Kit format

/**
 * Parse AI response text and convert to Block Kit format
 * @param {string} text - Raw AI response text
 * @returns {Object} Block Kit message object
 */
export function formatResponseAsBlocks(text) {
  if (!text || typeof text !== 'string') {
    return { text: 'No response generated' };
  }

  // Split text into sections based on common patterns
  const sections = parseTextIntoSections(text);
  
  // Convert sections to Block Kit blocks
  const blocks = sections.map(section => createBlockFromSection(section));
  
  // Return Block Kit message format
  return {
    blocks: blocks
  };
}

/**
 * Parse text into logical sections
 * @param {string} text - Raw text
 * @returns {Array} Array of section objects
 */
function parseTextIntoSections(text) {
  const sections = [];
  const lines = text.split('\n');
  
  let currentSection = {
    type: 'paragraph',
    content: []
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
        currentSection = { type: 'paragraph', content: [] };
      }
      continue;
    }
    
    // Detect headers (lines that end with colon or are all caps)
    if (isHeader(line)) {
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      sections.push({
        type: 'header',
        content: line.replace(/[:*]/g, '').trim()
      });
      currentSection = { type: 'paragraph', content: [] };
      continue;
    }
    
    // Detect bullet points
    if (isBulletPoint(line)) {
      if (currentSection.type !== 'bullets') {
        if (currentSection.content.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { type: 'bullets', content: [] };
      }
      currentSection.content.push(line);
      continue;
    }
    
    // Regular paragraph content
    currentSection.content.push(line);
  }
  
  // Add final section
  if (currentSection.content.length > 0) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Check if line is a header
 * @param {string} line - Line to check
 * @returns {boolean}
 */
function isHeader(line) {
  // Headers typically end with colon or are short and descriptive
  return line.endsWith(':') || 
         (line.length < 50 && /^[A-Z][a-z\s]+$/.test(line)) ||
         line.match(/^\*.*\*:$/) ||
         line.match(/^#{1,6}\s/);
}

/**
 * Check if line is a bullet point
 * @param {string} line - Line to check
 * @returns {boolean}
 */
function isBulletPoint(line) {
  return line.match(/^[•\-\*]\s/) || 
         line.match(/^\d+\.\s/) ||
         line.match(/^[a-z]\)\s/);
}

/**
 * Create a Block Kit block from a section
 * @param {Object} section - Section object
 * @returns {Object} Block Kit block
 */
function createBlockFromSection(section) {
  switch (section.type) {
    case 'header':
      // Use bold text instead of header blocks for subtler appearance
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${section.content}*`
        }
      };
      
    case 'bullets':
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: section.content.join('\n')
        }
      };
      
    case 'paragraph':
    default:
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: section.content.join('\n\n')
        }
      };
  }
}

/**
 * Add emojis to enhance visual appeal
 * @param {string} text - Text to enhance
 * @returns {string} Text with relevant emojis
 */
function addEmojis(text) {
  const emojiMap = {
    'overview': '🔍',
    'summary': '📋',
    'analysis': '🔬',
    'recommendation': '💡',
    'recommendations': '💡',
    'action': '⚡',
    'actions': '⚡',
    'warning': '⚠️',
    'warnings': '⚠️',
    'error': '❌',
    'errors': '❌',
    'success': '✅',
    'completed': '✅',
    'temperature': '🌡️',
    'sensor': '📡',
    'alert': '🚨',
    'alerts': '🚨',
    'issue': '🔧',
    'issues': '🔧',
    'solution': '💡',
    'solutions': '💡',
    'next steps': '👣',
    'conclusion': '🎯',
    'important': '⭐',
    'note': '📝',
    'notes': '📝'
  };
  
  let enhancedText = text;
  
  // Add emojis to headers
  Object.entries(emojiMap).forEach(([keyword, emoji]) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    enhancedText = enhancedText.replace(regex, `${emoji} ${keyword}`);
  });
  
  return enhancedText;
}

/**
 * Format a simple text response as Block Kit (fallback)
 * @param {string} text - Simple text
 * @returns {Object} Block Kit message
 */
export function formatSimpleTextAsBlocks(text) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: text
        }
      }
    ]
  };
}
