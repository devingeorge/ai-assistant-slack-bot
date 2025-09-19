// src/services/channelMonitoring.js
import { redis } from './memory.js';
import { logger } from '../lib/logger.js';

/** Generate storage key for monitored channels */
function monitoredChannelsKey(teamId) {
  return `monitored_channels:${teamId}`;
}

/** Get all monitored channels for a team */
export async function getMonitoredChannels(teamId) {
  try {
    const key = monitoredChannelsKey(teamId);
    const channels = await redis.get(key);
    return channels ? JSON.parse(channels) : [];
  } catch (error) {
    logger.error('Error getting monitored channels:', error);
    return [];
  }
}

/** Add a channel to monitoring */
export async function addMonitoredChannel(teamId, channelData) {
  try {
    const channels = await getMonitoredChannels(teamId);
    
    // Check if already monitoring 5 channels (max limit)
    if (channels.length >= 5) {
      return { success: false, error: 'Maximum of 5 channels can be monitored' };
    }
    
    // Check if channel is already being monitored
    const existingChannel = channels.find(c => c.channelId === channelData.channelId);
    if (existingChannel) {
      return { success: false, error: 'Channel is already being monitored' };
    }
    
    const newChannel = {
      channelId: channelData.channelId,
      channelName: channelData.channelName,
      responseType: channelData.responseType || 'analytical',
      enabled: channelData.enabled !== false,
      autoCreateJiraTickets: channelData.autoCreateJiraTickets || false,
      addedAt: new Date().toISOString(),
      addedBy: channelData.addedBy
    };
    
    channels.push(newChannel);
    
    const key = monitoredChannelsKey(teamId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(channels)); // 1 year TTL
    
    logger.info('Added monitored channel:', { teamId, channelData });
    return { success: true, channel: newChannel };
  } catch (error) {
    logger.error('Error adding monitored channel:', error);
    return { success: false, error: error.message };
  }
}

/** Update a monitored channel */
export async function updateMonitoredChannel(teamId, channelId, updates) {
  try {
    const channels = await getMonitoredChannels(teamId);
    const channelIndex = channels.findIndex(c => c.channelId === channelId);
    
    if (channelIndex === -1) {
      return { success: false, error: 'Channel not found' };
    }
    
    channels[channelIndex] = { 
      ...channels[channelIndex], 
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    const key = monitoredChannelsKey(teamId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(channels));
    
    logger.info('Updated monitored channel:', { teamId, channelId, updates });
    return { success: true, channel: channels[channelIndex] };
  } catch (error) {
    logger.error('Error updating monitored channel:', error);
    return { success: false, error: error.message };
  }
}

/** Remove a channel from monitoring */
export async function removeMonitoredChannel(teamId, channelId) {
  try {
    const channels = await getMonitoredChannels(teamId);
    const filteredChannels = channels.filter(c => c.channelId !== channelId);
    
    if (channels.length === filteredChannels.length) {
      return { success: false, error: 'Channel not found' };
    }
    
    const key = monitoredChannelsKey(teamId);
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(filteredChannels));
    
    logger.info('Removed monitored channel:', { teamId, channelId });
    return { success: true };
  } catch (error) {
    logger.error('Error removing monitored channel:', error);
    return { success: false, error: error.message };
  }
}

/** Check if a channel is being monitored */
export async function isChannelMonitored(teamId, channelId) {
  try {
    const channels = await getMonitoredChannels(teamId);
    const channel = channels.find(c => c.channelId === channelId && c.enabled);
    return channel || null;
  } catch (error) {
    logger.error('Error checking if channel is monitored:', error);
    return null;
  }
}

/** Get response types available for channel monitoring */
export function getResponseTypes() {
  return [
    {
      value: 'analytical',
      label: 'Analytical',
      description: 'Analyze messages for insights, patterns, and key points'
    },
    {
      value: 'summary',
      label: 'Summary',
      description: 'Provide concise summaries of recent activity'
    },
    {
      value: 'questions',
      label: 'Questions',
      description: 'Ask clarifying questions to facilitate discussion'
    },
    {
      value: 'insights',
      label: 'Insights',
      description: 'Share observations and actionable insights'
    }
  ];
}

/** Generate storage key for thread response counts */
function threadResponseCountKey(teamId, channelId, threadTs) {
  return `thread_response_count:${teamId}:${channelId}:${threadTs}`;
}

/** Increment and get bot response count for a thread */
export async function incrementThreadResponseCount(teamId, channelId, threadTs) {
  try {
    const key = threadResponseCountKey(teamId, channelId, threadTs);
    const currentCount = await redis.incr(key);
    
    // Set expiration to 30 days to prevent unlimited growth
    if (currentCount === 1) {
      await redis.expire(key, 30 * 24 * 3600);
    }
    
    logger.info('Incremented thread response count:', { teamId, channelId, threadTs, count: currentCount });
    return currentCount;
  } catch (error) {
    logger.error('Error incrementing thread response count:', error);
    return 0;
  }
}

/** Get current bot response count for a thread */
export async function getThreadResponseCount(teamId, channelId, threadTs) {
  try {
    const key = threadResponseCountKey(teamId, channelId, threadTs);
    const count = await redis.get(key);
    return count ? parseInt(count) : 0;
  } catch (error) {
    logger.error('Error getting thread response count:', error);
    return 0;
  }
}
