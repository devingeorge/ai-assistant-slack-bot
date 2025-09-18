// src/services/store.js
// Simple abstraction over Redis memory so we can swap/extend later.

import { appendMessage, loadHistory, clearUserMemory } from './memory.js';
import { redis } from './memory.js';

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
  },
  
  // Generic Redis methods for triggers and other data
  async get(key) {
    try {
      console.log('🔍 Store.get called:', key);
      const value = await redis.get(key);
      console.log('🔍 Store.get result:', { key, value: value ? 'found' : 'null', length: value?.length });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Store.get error:', error);
      return null;
    }
  },
  
  async set(key, value, ttlSeconds = null) {
    try {
      console.log('💾 Store.set called:', { key, valueType: typeof value, ttlSeconds });
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
      console.log('💾 Store.set success:', key);
      return true;
    } catch (error) {
      console.error('Store.set error:', error);
      return false;
    }
  },
  
  async del(key) {
    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Store.del error:', error);
      return false;
    }
  }
};
