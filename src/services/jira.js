// src/services/jira.js
// Jira integration service for creating tickets from Slack conversations

import JiraClient from 'node-jira-client';
import { redis } from './memory.js';
import { logger } from '../lib/logger.js';

// Get Jira configuration for a workspace
export async function getJiraConfig(teamId) {
  try {
    const key = `jira:${teamId}`;
    console.log('🔍 Getting Jira config for key:', key);
    
    const configData = await redis.get(key);
    console.log('🔍 Raw Redis data:', configData);
    
    if (!configData) {
      console.log('🔍 No Jira config found for team:', teamId);
      
      // Fallback: check if there are ANY jira keys in Redis
      const allJiraKeys = await redis.keys('jira:*');
      console.log('🔍 All Jira keys in Redis:', allJiraKeys);
      
      if (allJiraKeys.length > 0) {
        console.log('🔍 Found Jira configs but not for this team ID - potential mismatch');
        // Try the first one as a fallback (for debugging)
        const fallbackData = await redis.get(allJiraKeys[0]);
        if (fallbackData) {
          const fallbackConfig = JSON.parse(fallbackData);
          console.log('🔍 Fallback config from', allJiraKeys[0], ':', {
            baseUrl: fallbackConfig.baseUrl,
            project: fallbackConfig.defaultProject
          });
        }
      }
      
      return null;
    }
    
    const parsedConfig = JSON.parse(configData);
    console.log('🔍 Parsed Jira config:', { 
      baseUrl: parsedConfig.baseUrl, 
      project: parsedConfig.defaultProject,
      hasApiToken: !!parsedConfig.apiToken 
    });
    
    return parsedConfig;
  } catch (error) {
    logger.error('Failed to get Jira config:', error);
    console.error('🔍 Jira config error details:', error);
    return null;
  }
}

// Save Jira configuration for a workspace
export async function saveJiraConfig(teamId, config) {
  try {
    const key = `jira:${teamId}`;
    console.log('💾 Saving Jira config for key:', key);
    console.log('💾 Config being saved:', { 
      baseUrl: config.baseUrl,
      project: config.defaultProject,
      issueType: config.defaultIssueType 
    });
    
    await redis.setex(key, 365 * 24 * 3600, JSON.stringify(config)); // 1 year TTL
    
    // Verify it was saved
    const verification = await redis.get(key);
    console.log('💾 Verification read:', verification ? 'SUCCESS' : 'FAILED');
    
    logger.info(`Jira config saved for team ${teamId}`, { 
      baseUrl: config.baseUrl,
      project: config.defaultProject 
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to save Jira config:', error);
    console.error('💾 Save error details:', error);
    return false;
  }
}

// Test Jira connection
export async function testJiraConnection(config) {
  try {
    const jira = new JiraClient({
      protocol: 'https',
      host: config.baseUrl.replace(/^https?:\/\//, ''),
      username: config.email,
      password: config.apiToken,
      apiVersion: '2',
      strictSSL: true
    });

    // Test by getting current user info
    await jira.getCurrentUser();
    
    // Test project access
    if (config.defaultProject) {
      await jira.getProject(config.defaultProject);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Jira connection test failed:', error);
    return { 
      success: false, 
      error: error.message || 'Connection failed' 
    };
  }
}

// Create Jira ticket
export async function createJiraTicket(teamId, ticketData) {
  try {
    const config = await getJiraConfig(teamId);
    if (!config) {
      throw new Error('Jira not configured for this workspace');
    }

    const jira = new JiraClient({
      protocol: 'https',
      host: config.baseUrl.replace(/^https?:\/\//, ''),
      username: config.email,
      password: config.apiToken,
      apiVersion: '2',
      strictSSL: true
    });

    const issueData = {
      fields: {
        project: { key: config.defaultProject },
        summary: ticketData.summary,
        description: ticketData.description,
        issuetype: { name: config.defaultIssueType || ticketData.issueType || 'Task' },
        ...(ticketData.priority && { priority: { name: ticketData.priority } }),
        ...(ticketData.assignee && { assignee: { name: ticketData.assignee } }),
        ...(ticketData.labels && { labels: ticketData.labels })
      }
    };

    const result = await jira.addNewIssue(issueData);
    
    logger.info(`Jira ticket created for team ${teamId}`, {
      key: result.key,
      summary: ticketData.summary
    });

    return {
      success: true,
      ticket: {
        key: result.key,
        url: `${config.baseUrl}/browse/${result.key}`,
        summary: ticketData.summary
      }
    };
  } catch (error) {
    logger.error('Failed to create Jira ticket:', error);
    
    // Extract more helpful error messages from Jira API
    let errorMessage = 'Failed to create ticket';
    if (error.response?.data?.errorMessages) {
      errorMessage = error.response.data.errorMessages.join(', ');
    } else if (error.response?.data?.errors) {
      const errors = Object.entries(error.response.data.errors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
      errorMessage = errors;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Extract ticket information from conversation context
export function extractTicketFromContext(userMessage, recentMessages = []) {
  // Simple extraction logic - could be enhanced with AI
  const summary = userMessage.slice(0, 100).trim();
  
  // Build description from context
  let description = `**From Slack conversation:**\n\n`;
  description += `User request: ${userMessage}\n\n`;
  
  if (recentMessages.length > 0) {
    description += `**Recent context:**\n`;
    recentMessages.slice(-5).forEach(msg => {
      if (msg.text && msg.user) {
        description += `- ${msg.user}: ${msg.text.slice(0, 200)}\n`;
      }
    });
  }

  // Detect priority keywords
  let priority = 'Medium';
  const urgentKeywords = ['urgent', 'critical', 'emergency', 'asap', 'blocking'];
  const highKeywords = ['important', 'high', 'soon', 'bug', 'broken'];
  
  const lowerText = userMessage.toLowerCase();
  if (urgentKeywords.some(keyword => lowerText.includes(keyword))) {
    priority = 'Critical';
  } else if (highKeywords.some(keyword => lowerText.includes(keyword))) {
    priority = 'High';
  }

  // Detect issue type
  let issueType = 'Task';
  if (lowerText.includes('bug') || lowerText.includes('error') || lowerText.includes('broken')) {
    issueType = 'Bug';
  } else if (lowerText.includes('feature') || lowerText.includes('enhancement')) {
    issueType = 'Story';
  }

  return {
    summary,
    description,
    priority,
    issueType
  };
}
