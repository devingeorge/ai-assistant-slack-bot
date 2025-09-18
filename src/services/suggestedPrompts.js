// src/services/suggestedPrompts.js
import { store } from './store.js';
import { logger } from '../lib/logger.js';

/** Generate suggested prompt storage key */
function suggestedPromptKey(teamId, userId) {
  return `suggested_prompts:${teamId}:${userId}`;
}

/** Generate unique prompt ID */
function generatePromptId() {
  return `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Save a suggested prompt */
export async function saveSuggestedPrompt(teamId, userId, promptData) {
  try {
    const prompt = {
      id: promptData.id || generatePromptId(),
      name: promptData.name,
      prompt: promptData.prompt,
      response: promptData.response,
      enabled: promptData.enabled !== false,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    // Update existing or add new
    const existingIndex = prompts.findIndex(p => p.id === prompt.id);
    if (existingIndex >= 0) {
      prompts[existingIndex] = { ...prompts[existingIndex], ...prompt };
    } else {
      prompts.push(prompt);
    }

    // Limit to 3 prompts maximum
    if (prompts.length > 3) {
      prompts.splice(3);
    }

    await store.set(key, prompts);
    logger.info('Suggested prompt saved:', { teamId, userId, promptId: prompt.id });
    
    return { success: true, prompt };
  } catch (error) {
    logger.error('Error saving suggested prompt:', error);
    return { success: false, error: error.message };
  }
}

/** Get all suggested prompts for a user */
export async function getSuggestedPrompts(teamId, userId) {
  try {
    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    // Return only enabled prompts
    return prompts.filter(p => p.enabled !== false);
  } catch (error) {
    logger.error('Error getting suggested prompts:', error);
    return [];
  }
}

/** Get all suggested prompts (including disabled) for management */
export async function getAllSuggestedPrompts(teamId, userId) {
  try {
    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    return prompts;
  } catch (error) {
    logger.error('Error getting all suggested prompts:', error);
    return [];
  }
}

/** Delete a suggested prompt */
export async function deleteSuggestedPrompt(teamId, userId, promptId) {
  try {
    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    if (promptIndex >= 0) {
      prompts.splice(promptIndex, 1);
      await store.set(key, prompts);
      logger.info('Suggested prompt deleted:', { teamId, userId, promptId });
      return { success: true };
    } else {
      return { success: false, error: 'Prompt not found' };
    }
  } catch (error) {
    logger.error('Error deleting suggested prompt:', error);
    return { success: false, error: error.message };
  }
}

/** Toggle prompt enabled/disabled */
export async function toggleSuggestedPrompt(teamId, userId, promptId) {
  try {
    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    if (promptIndex >= 0) {
      prompts[promptIndex].enabled = !prompts[promptIndex].enabled;
      prompts[promptIndex].updatedAt = new Date().toISOString();
      await store.set(key, prompts);
      return { success: true, enabled: prompts[promptIndex].enabled };
    } else {
      return { success: false, error: 'Prompt not found' };
    }
  } catch (error) {
    logger.error('Error toggling suggested prompt:', error);
    return { success: false, error: error.message };
  }
}

/** Get a specific prompt by ID */
export async function getSuggestedPromptById(teamId, userId, promptId) {
  try {
    const key = suggestedPromptKey(teamId, userId);
    const prompts = await store.get(key) || [];
    
    return prompts.find(p => p.id === promptId) || null;
  } catch (error) {
    logger.error('Error getting suggested prompt by ID:', error);
    return null;
  }
}
