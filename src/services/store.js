// src/services/store.js
// Simple abstraction over Redis memory so we can swap/extend later.

import { appendMessage, loadHistory, clearUserMemory } from './memory.js';

export const store = {
  async addUserTurn(key, text) {
    await appendMessage(key, { role: 'user', content: text });
  },
  async addAssistantTurn(key, text) {
    await appendMessage(key, { role: 'assistant', content: text });
  },
  async history(key, limit) {
    return loadHistory(key, limit);
  },
  async clearUser(team, user) {
    return clearUserMemory(team, user);
  }
};
