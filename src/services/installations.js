// src/services/installations.js
import { redis } from './memory.js';
import { logger } from '../lib/logger.js';

/**
 * Save installation data when a team installs the app
 */
export async function saveInstallation(installation) {
  try {
    logger.info('Saving installation - full installation data:', JSON.stringify(installation, null, 2));
    
    const teamId = installation.team?.id;
    const enterpriseId = installation.enterprise?.id;
    
    logger.info('Extracted IDs:', { teamId, enterpriseId, hasTeam: !!installation.team, hasEnterprise: !!installation.enterprise });
    
    if (!teamId) {
      logger.error('Missing team ID in installation data:', installation);
      throw new Error('Missing team ID in installation');
    }

    // Create a key for this installation
    const key = `installation:${enterpriseId || 'none'}:${teamId}`;
    
    // Store the installation data
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(installation)); // 1 year TTL
    
    logger.info('Saved installation:', { teamId, enterpriseId, key });
    
    return installation;
  } catch (error) {
    logger.error('Failed to save installation:', error);
    throw error;
  }
}

/**
 * Fetch installation data for OAuth token lookups
 */
export async function getInstallation(installQuery) {
  try {
    const { teamId, enterpriseId, userId } = installQuery;
    
    logger.info('Getting installation with query:', { teamId, enterpriseId, userId });
    
    if (!teamId) {
      logger.error('Missing team ID in install query:', installQuery);
      throw new Error('Missing team ID in install query');
    }

    // Look up the installation
    const key = `installation:${enterpriseId || 'none'}:${teamId}`;
    logger.info('Looking up installation with key:', key);
    
    const installationData = await redis.get(key);
    
    if (!installationData) {
      logger.warn('Installation not found:', { teamId, enterpriseId, userId, key });
      
      // Try to list all installation keys for debugging
      const allKeys = await redis.keys('installation:*');
      logger.info('All installation keys in database:', allKeys);
      
      throw new Error('Installation not found');
    }

    const installation = JSON.parse(installationData);
    
    logger.info('Retrieved installation:', { teamId, enterpriseId, userId });
    
    return installation;
  } catch (error) {
    logger.error('Failed to fetch installation:', error);
    throw error;
  }
}

/**
 * Delete installation data when app is uninstalled
 */
export async function deleteInstallation(installQuery) {
  try {
    const { teamId, enterpriseId } = installQuery;
    
    if (!teamId) {
      throw new Error('Missing team ID in install query');
    }

    const key = `installation:${enterpriseId || 'none'}:${teamId}`;
    await redis.del(key);
    
    // Also clear any cached data for this team (but NOT installation data)
    const patterns = [`convo:${teamId}:*`, `assistant_thread:${teamId}:*`, `assistant_ctx:${teamId}:*`];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    
    logger.info('Deleted installation and team data:', { teamId, enterpriseId });
  } catch (error) {
    logger.error('Failed to delete installation:', error);
    throw error;
  }
}

/**
 * List all installed teams (for admin purposes)
 */
export async function listInstallations() {
  try {
    const keys = await redis.keys('installation:*');
    const installations = [];
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const installation = JSON.parse(data);
        installations.push({
          teamId: installation.team?.id,
          teamName: installation.team?.name,
          enterpriseId: installation.enterprise?.id,
          installedAt: installation.installedAt || 'unknown',
          key
        });
      }
    }
    
    return installations;
  } catch (error) {
    logger.error('Failed to list installations:', error);
    throw error;
  }
}
