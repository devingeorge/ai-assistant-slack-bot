#!/usr/bin/env node

/**
 * Generate a secure SLACK_STATE_SECRET for OAuth
 * Run this script to generate a proper state secret for your Slack app
 */

import crypto from 'crypto';

console.log('🔐 Generating SLACK_STATE_SECRET for OAuth...');
console.log('===============================================');

// Generate a secure random string
const stateSecret = crypto.randomBytes(32).toString('base64');

console.log('');
console.log('✅ Generated SLACK_STATE_SECRET:');
console.log('');
console.log(`SLACK_STATE_SECRET=${stateSecret}`);
console.log('');
console.log('📋 To use this:');
console.log('1. Copy the SLACK_STATE_SECRET value above');
console.log('2. Add it to your Render environment variables');
console.log('3. Redeploy your service');
console.log('4. Try installing your Slack app again');
console.log('');
console.log('⚠️  Important:');
console.log('- Keep this secret secure');
console.log('- Use the same value across deployments');
console.log('- Don\'t change it once your app is installed');
console.log('');
console.log('🔗 Render Dashboard: https://dashboard.render.com');
