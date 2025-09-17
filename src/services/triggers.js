// src/services/triggers.js
import { store } from './store.js';
import { logger } from '../lib/logger.js';

/** Generate trigger storage key */
function triggerKey(teamId, userId, scope = 'personal') {
  if (scope === 'workspace') {
    return `triggers:workspace:${teamId}`;
  }
  return `triggers:personal:${teamId}:${userId}`;
}

/** Generate unique trigger ID */
function generateTriggerId() {
  return `trigger_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Save a trigger */
export async function saveTrigger(teamId, userId, triggerData, isAdmin = false) {
  try {
    const scope = triggerData.scope || 'personal';
    
    // Only admins can create workspace-wide triggers
    if (scope === 'workspace' && !isAdmin) {
      return { success: false, error: 'Only admins can create workspace-wide triggers' };
    }

    const trigger = {
      id: triggerData.id || generateTriggerId(),
      name: triggerData.name,
      inputPhrases: triggerData.inputPhrases.map(phrase => phrase.toLowerCase().trim()),
      response: triggerData.response,
      scope,
      enabled: triggerData.enabled !== false,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const key = triggerKey(teamId, userId, scope);
    const triggers = await store.get(key) || [];
    
    // Update existing or add new
    const existingIndex = triggers.findIndex(t => t.id === trigger.id);
    if (existingIndex >= 0) {
      triggers[existingIndex] = { ...triggers[existingIndex], ...trigger };
    } else {
      triggers.push(trigger);
    }

    await store.set(key, triggers);
    logger.info('Trigger saved:', { teamId, userId, triggerId: trigger.id, scope });
    
    return { success: true, trigger };
  } catch (error) {
    logger.error('Error saving trigger:', error);
    return { success: false, error: error.message };
  }
}

/** Get all triggers for a user/team */
export async function getTriggers(teamId, userId) {
  try {
    const personalKey = triggerKey(teamId, userId, 'personal');
    const workspaceKey = triggerKey(teamId, userId, 'workspace');
    
    const [personalTriggers, workspaceTriggers] = await Promise.all([
      store.get(personalKey) || [],
      store.get(workspaceKey) || []
    ]);

    const allTriggers = [
      ...personalTriggers.filter(t => t.enabled !== false),
      ...workspaceTriggers.filter(t => t.enabled !== false)
    ];

    return allTriggers;
  } catch (error) {
    logger.error('Error getting triggers:', error);
    return [];
  }
}

/** Get user's personal triggers for management */
export async function getPersonalTriggers(teamId, userId) {
  try {
    const key = triggerKey(teamId, userId, 'personal');
    return await store.get(key) || [];
  } catch (error) {
    logger.error('Error getting personal triggers:', error);
    return [];
  }
}

/** Delete a trigger */
export async function deleteTrigger(teamId, userId, triggerId, isAdmin = false) {
  try {
    // Check both personal and workspace triggers
    const personalKey = triggerKey(teamId, userId, 'personal');
    const workspaceKey = triggerKey(teamId, userId, 'workspace');
    
    let found = false;
    
    // Check personal triggers
    const personalTriggers = await store.get(personalKey) || [];
    const personalIndex = personalTriggers.findIndex(t => t.id === triggerId);
    if (personalIndex >= 0) {
      personalTriggers.splice(personalIndex, 1);
      await store.set(personalKey, personalTriggers);
      found = true;
    }
    
    // Check workspace triggers (admin only)
    if (isAdmin) {
      const workspaceTriggers = await store.get(workspaceKey) || [];
      const workspaceIndex = workspaceTriggers.findIndex(t => t.id === triggerId);
      if (workspaceIndex >= 0) {
        workspaceTriggers.splice(workspaceIndex, 1);
        await store.set(workspaceKey, workspaceTriggers);
        found = true;
      }
    }

    if (found) {
      logger.info('Trigger deleted:', { teamId, userId, triggerId });
      return { success: true };
    } else {
      return { success: false, error: 'Trigger not found or no permission' };
    }
  } catch (error) {
    logger.error('Error deleting trigger:', error);
    return { success: false, error: error.message };
  }
}

/** Find matching trigger for input text */
export async function findMatchingTrigger(teamId, userId, inputText) {
  try {
    const triggers = await getTriggers(teamId, userId);
    const normalizedInput = inputText.toLowerCase().trim();
    
    for (const trigger of triggers) {
      for (const phrase of trigger.inputPhrases) {
        if (normalizedInput.includes(phrase)) {
          logger.info('Trigger matched:', { 
            teamId, 
            userId, 
            triggerId: trigger.id, 
            phrase, 
            inputText: inputText.slice(0, 50) 
          });
          return trigger;
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding matching trigger:', error);
    return null;
  }
}

/** Toggle trigger enabled/disabled */
export async function toggleTrigger(teamId, userId, triggerId, isAdmin = false) {
  try {
    const personalKey = triggerKey(teamId, userId, 'personal');
    const workspaceKey = triggerKey(teamId, userId, 'workspace');
    
    // Check personal triggers first
    const personalTriggers = await store.get(personalKey) || [];
    const personalIndex = personalTriggers.findIndex(t => t.id === triggerId);
    if (personalIndex >= 0) {
      personalTriggers[personalIndex].enabled = !personalTriggers[personalIndex].enabled;
      personalTriggers[personalIndex].updatedAt = new Date().toISOString();
      await store.set(personalKey, personalTriggers);
      return { success: true, enabled: personalTriggers[personalIndex].enabled };
    }
    
    // Check workspace triggers (admin only)
    if (isAdmin) {
      const workspaceTriggers = await store.get(workspaceKey) || [];
      const workspaceIndex = workspaceTriggers.findIndex(t => t.id === triggerId);
      if (workspaceIndex >= 0) {
        workspaceTriggers[workspaceIndex].enabled = !workspaceTriggers[workspaceIndex].enabled;
        workspaceTriggers[workspaceIndex].updatedAt = new Date().toISOString();
        await store.set(workspaceKey, workspaceTriggers);
        return { success: true, enabled: workspaceTriggers[workspaceIndex].enabled };
      }
    }

    return { success: false, error: 'Trigger not found or no permission' };
  } catch (error) {
    logger.error('Error toggling trigger:', error);
    return { success: false, error: error.message };
  }
}

/** Get pre-defined templates */
export function getTemplates() {
  return {
    office_hours: [
      {
        name: 'Office Hours',
        inputPhrases: ['office hours', 'what time', 'when open', 'hours of operation', 'business hours'],
        response: '🕒 Our office hours are Monday-Friday, 9:00 AM to 5:00 PM EST.\n\nFor urgent matters outside business hours, please email support@company.com',
        scope: 'workspace'
      },
      {
        name: 'Contact Information',
        inputPhrases: ['contact', 'phone number', 'email', 'how to reach', 'support'],
        response: '📞 **Contact Information**\n• Support: support@company.com\n• Sales: sales@company.com\n• Phone: 1-800-COMPANY\n• Emergency: emergency@company.com',
        scope: 'workspace'
      }
    ],
    it_support: [
      {
        name: 'Password Reset',
        inputPhrases: ['password reset', 'forgot password', 'login issues', 'cant log in', 'password help'],
        response: '🔐 **Password Reset Help**\n1. Go to company.com/reset\n2. Enter your email address\n3. Check your email for reset link\n4. If you don\'t receive it, contact IT: it-help@company.com',
        scope: 'workspace'
      },
      {
        name: 'WiFi Information',
        inputPhrases: ['wifi', 'wireless', 'internet', 'network password', 'wifi password'],
        response: '📶 **WiFi Information**\n• Network: Company-WiFi\n• Guest Network: Company-Guest\n• For credentials, contact IT or check the #it-announcements channel',
        scope: 'workspace'
      }
    ],
    policies: [
      {
        name: 'PTO Policy',
        inputPhrases: ['pto', 'vacation', 'time off', 'sick days', 'leave policy'],
        response: '🏖️ **PTO Policy**\nRequest time off through the HR portal: company.com/hr\n• Submit requests 2 weeks in advance\n• Check with your manager first\n• Emergency time off: contact HR directly',
        scope: 'workspace'
      },
      {
        name: 'Expense Reports',
        inputPhrases: ['expense', 'reimbursement', 'receipt', 'expense report', 'travel expenses'],
        response: '💰 **Expense Reports**\nSubmit expenses through: company.com/expenses\n• Include receipts for purchases >$25\n• Submit within 30 days\n• Questions? Contact accounting@company.com',
        scope: 'workspace'
      }
    ],
    meeting_rooms: [
      {
        name: 'Room Booking',
        inputPhrases: ['book room', 'meeting room', 'conference room', 'room availability', 'reserve room'],
        response: '🏢 **Meeting Room Booking**\nBook rooms through Outlook calendar or company.com/rooms\n• Large rooms: Conference A (12 people), Conference B (8 people)\n• Small rooms: Focus 1-4 (4 people each)\n• AV setup help: facilities@company.com',
        scope: 'workspace'
      }
    ],
    dev_resources: [
      {
        name: 'Code Repository',
        inputPhrases: ['repo', 'repository', 'code', 'github', 'git', 'source code'],
        response: '💻 **Development Resources**\n• Main repo: github.com/company/main-app\n• Docs: docs.company.com\n• Style guide: company.com/style-guide\n• Need access? Contact dev-ops@company.com',
        scope: 'workspace'
      },
      {
        name: 'Deployment Process',
        inputPhrases: ['deploy', 'deployment', 'release', 'production', 'staging'],
        response: '🚀 **Deployment Process**\n1. Create PR to `main` branch\n2. Get code review approval\n3. Merge triggers auto-deploy to staging\n4. Production deploys: Monday/Wednesday/Friday 2 PM EST\n\nDocs: docs.company.com/deployment',
        scope: 'workspace'
      }
    ]
  };
}

/** Import selected templates */
export async function importTemplates(teamId, userId, selectedTemplates, isAdmin = false) {
  try {
    const templates = getTemplates();
    const results = [];
    
    for (const templateKey of selectedTemplates) {
      if (templates[templateKey]) {
        for (const triggerData of templates[templateKey]) {
          // Only allow workspace scope for admins
          if (triggerData.scope === 'workspace' && !isAdmin) {
            triggerData.scope = 'personal';
          }
          
          const result = await saveTrigger(teamId, userId, triggerData, isAdmin);
          results.push(result);
        }
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return { 
      success: true, 
      imported: successful, 
      failed,
      results 
    };
  } catch (error) {
    logger.error('Error importing templates:', error);
    return { success: false, error: error.message };
  }
}
