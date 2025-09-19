// src/services/urlKnowledge.js
import { redis } from './memory.js';
import { logger } from '../lib/logger.js';

/** Generate storage key for user's URL knowledge sources */
function userUrlsKey(teamId, userId) {
  return `user_urls:${teamId}:${userId}`;
}

/** Get all URLs for a user */
export async function getUserUrls(teamId, userId) {
  try {
    const key = userUrlsKey(teamId, userId);
    const urls = await redis.get(key);
    return urls ? JSON.parse(urls) : [];
  } catch (error) {
    logger.error('Error getting user URLs:', error);
    return [];
  }
}

/** Add a URL to user's knowledge sources */
export async function addUserUrl(teamId, userId, urlData) {
  try {
    const urls = await getUserUrls(teamId, userId);
    
    // Check if URL already exists
    const existingUrl = urls.find(u => u.url === urlData.url);
    if (existingUrl) {
      return { success: false, error: 'URL already exists in your knowledge sources' };
    }
    
    // Validate URL format
    try {
      new URL(urlData.url);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }
    
    const newUrl = {
      id: `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: urlData.url,
      title: urlData.title || urlData.url,
      description: urlData.description || '',
      enabled: urlData.enabled !== false,
      addedAt: new Date().toISOString(),
      lastCrawled: null,
      crawlStatus: 'pending', // pending, crawling, completed, failed
      errorMessage: null
    };
    
    urls.push(newUrl);
    
    const key = userUrlsKey(teamId, userId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(urls)); // 1 year TTL
    
    logger.info('Added user URL:', { teamId, userId, urlData });
    return { success: true, url: newUrl };
  } catch (error) {
    logger.error('Error adding user URL:', error);
    return { success: false, error: error.message };
  }
}

/** Update a URL */
export async function updateUserUrl(teamId, userId, urlId, updates) {
  try {
    const urls = await getUserUrls(teamId, userId);
    const urlIndex = urls.findIndex(u => u.id === urlId);
    
    if (urlIndex === -1) {
      return { success: false, error: 'URL not found' };
    }
    
    urls[urlIndex] = { 
      ...urls[urlIndex], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const key = userUrlsKey(teamId, userId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(urls));
    
    logger.info('Updated user URL:', { teamId, userId, urlId, updates });
    return { success: true, url: urls[urlIndex] };
  } catch (error) {
    logger.error('Error updating user URL:', error);
    return { success: false, error: error.message };
  }
}

/** Remove a URL from user's knowledge sources */
export async function removeUserUrl(teamId, userId, urlId) {
  try {
    const urls = await getUserUrls(teamId, userId);
    const filteredUrls = urls.filter(u => u.id !== urlId);
    
    if (urls.length === filteredUrls.length) {
      return { success: false, error: 'URL not found' };
    }
    
    const key = userUrlsKey(teamId, userId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(filteredUrls));
    
    logger.info('Removed user URL:', { teamId, userId, urlId });
    return { success: true };
  } catch (error) {
    logger.error('Error removing user URL:', error);
    return { success: false, error: error.message };
  }
}

/** Clear all URLs for a user */
export async function clearAllUserUrls(teamId, userId) {
  try {
    const key = userUrlsKey(teamId, userId);
    await redis.del(key);
    
    logger.info('Cleared all user URLs:', { teamId, userId });
    return { success: true };
  } catch (error) {
    logger.error('Error clearing user URLs:', error);
    return { success: false, error: error.message };
  }
}

/** Get URLs for RAG context retrieval */
export async function getEnabledUrlsForContext(teamId, userId) {
  try {
    const urls = await getUserUrls(teamId, userId);
    return urls.filter(url => url.enabled && url.crawlStatus === 'completed');
  } catch (error) {
    logger.error('Error getting enabled URLs for context:', error);
    return [];
  }
}

/** Update crawl status for a URL */
export async function updateUrlCrawlStatus(teamId, userId, urlId, status, errorMessage = null) {
  try {
    const updates = {
      crawlStatus: status,
      lastCrawled: status === 'completed' ? new Date().toISOString() : null,
      errorMessage
    };
    
    return await updateUserUrl(teamId, userId, urlId, updates);
  } catch (error) {
    logger.error('Error updating URL crawl status:', error);
    return { success: false, error: error.message };
  }
}

/** Validate URL accessibility */
export async function validateUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SlackBot/1.0)'
      }
    });
    
    return {
      accessible: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      lastModified: response.headers.get('last-modified')
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message
    };
  }
}
