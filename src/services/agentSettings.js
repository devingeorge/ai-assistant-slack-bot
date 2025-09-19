// src/services/agentSettings.js
import { store } from './store.js';
import { logger } from '../lib/logger.js';

/** Generate agent settings storage key */
function agentSettingsKey(teamId, userId) {
  return `agent_settings:${teamId}:${userId}`;
}

/** Default agent settings */
const defaultSettings = {
  tone: 'professional',
  companyType: 'general',
  specialty: '',
  responseLength: 'balanced',
  languageStyle: 'conversational',
  customInstructions: '',
  autoCreateCanvas: false
};

/** Get user's agent settings */
export async function getAgentSettings(teamId, userId) {
  try {
    const key = agentSettingsKey(teamId, userId);
    const settings = await store.get(key);
    
    // Return default settings if none exist
    return settings || { ...defaultSettings };
  } catch (error) {
    logger.error('Error getting agent settings:', error);
    return { ...defaultSettings };
  }
}

/** Save user's agent settings */
export async function saveAgentSettings(teamId, userId, settings) {
  try {
    const key = agentSettingsKey(teamId, userId);
    
    // Merge with defaults to ensure all fields exist
    const mergedSettings = { ...defaultSettings, ...settings };
    
    await store.set(key, mergedSettings);
    return { success: true };
  } catch (error) {
    logger.error('Error saving agent settings:', error);
    return { success: false, error: error.message };
  }
}

/** Get available tone options */
export function getToneOptions() {
  return [
    { value: 'professional', label: 'Professional', description: 'Formal and business-appropriate' },
    { value: 'casual', label: 'Casual', description: 'Relaxed and friendly' },
    { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
    { value: 'technical', label: 'Technical', description: 'Precise and detailed' },
    { value: 'supportive', label: 'Supportive', description: 'Encouraging and helpful' }
  ];
}

/** Get available company type options */
export function getCompanyTypeOptions() {
  return [
    { value: 'general', label: 'General Business', description: 'Standard business environment' },
    { value: 'tech', label: 'Technology', description: 'Software, IT, or tech company' },
    { value: 'manufacturing', label: 'Manufacturing', description: 'Production and factory operations' },
    { value: 'healthcare', label: 'Healthcare', description: 'Medical and healthcare services' },
    { value: 'finance', label: 'Finance', description: 'Banking, insurance, or financial services' },
    { value: 'retail', label: 'Retail', description: 'Consumer goods and retail' },
    { value: 'education', label: 'Education', description: 'Schools, universities, or training' },
    { value: 'nonprofit', label: 'Non-Profit', description: 'Charitable or non-profit organization' }
  ];
}

/** Get available response length options */
export function getResponseLengthOptions() {
  return [
    { value: 'brief', label: 'Brief', description: 'Short, concise responses' },
    { value: 'balanced', label: 'Balanced', description: 'Moderate length responses' },
    { value: 'detailed', label: 'Detailed', description: 'Comprehensive, thorough responses' }
  ];
}

/** Get available language style options */
export function getLanguageStyleOptions() {
  return [
    { value: 'conversational', label: 'Conversational', description: 'Natural, chat-like responses' },
    { value: 'formal', label: 'Formal', description: 'Structured, professional language' },
    { value: 'technical', label: 'Technical', description: 'Precise, industry-specific terms' }
  ];
}

/** Get specialty suggestions based on company type */
export function getSpecialtySuggestions(companyType) {
  const suggestions = {
    tech: [
      'Software development and code review',
      'DevOps and infrastructure management',
      'Cybersecurity and data protection',
      'Product management and user experience',
      'Technical documentation and training'
    ],
    manufacturing: [
      'Factory floor incident management',
      'Quality control and safety protocols',
      'Production planning and optimization',
      'Equipment maintenance and troubleshooting',
      'Supply chain and logistics'
    ],
    healthcare: [
      'Patient care coordination',
      'Medical record management',
      'HIPAA compliance and privacy',
      'Clinical workflow optimization',
      'Emergency response procedures'
    ],
    finance: [
      'Financial analysis and reporting',
      'Risk management and compliance',
      'Investment strategies and portfolio management',
      'Audit procedures and documentation',
      'Customer service and support'
    ],
    general: [
      'Project management and coordination',
      'Customer service and support',
      'Process improvement and optimization',
      'Training and development',
      'Documentation and knowledge management'
    ]
  };
  
  return suggestions[companyType] || suggestions.general;
}
