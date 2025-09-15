// src/index.js
import pkg from '@slack/bolt';
const { App, LogLevel, ExpressReceiver } = pkg;

import { config } from './config.js';
import { registerEvents } from './routes/events.js';
import { registerCommands } from './routes/commands.js';
import { registerActions } from './routes/actions.js';
import { clearAllState, redis } from './services/memory.js';
import { getInstallation, saveInstallation, deleteInstallation } from './services/installations.js';

// Check if we have the required environment variables
console.log('🔍 Environment Variables Check:');
console.log('   REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'MISSING');
console.log('   SLACK_SIGNING_SECRET:', config.slack.signingSecret ? 'SET' : 'MISSING');
console.log('   GROK_API_KEY:', process.env.GROK_API_KEY ? 'SET' : 'MISSING');
console.log('');

if (!config.slack.signingSecret) {
  console.error('❌ Missing SLACK_SIGNING_SECRET environment variable');
  console.log('📝 Please set the following environment variables in Railway:');
  console.log('   SLACK_CLIENT_ID=your-client-id');
  console.log('   SLACK_CLIENT_SECRET=your-client-secret');
  console.log('   SLACK_SIGNING_SECRET=your-signing-secret');
  console.log('   SLACK_STATE_SECRET=your-random-secret');
  console.log('   GROK_API_KEY=your-grok-api-key');
  console.log('   REDIS_URL=${{Redis.REDIS_URL}}');
  console.log('');
  console.log('🚂 The app will continue running to allow Railway to deploy');
  console.log('   but Slack functionality will not work until credentials are added.');
}

if (!process.env.REDIS_URL) {
  console.error('❌ Missing REDIS_URL environment variable');
  console.log('📝 Using fallback Redis URL: redis://localhost:6379');
  console.log('   This will fail in Railway. Please set REDIS_URL=${{Redis.REDIS_URL}}');
}

// Use ExpressReceiver for HTTP mode and OAuth
const receiver = new ExpressReceiver({
  signingSecret: config.slack.signingSecret || 'placeholder',
  clientId: config.slack.clientId || 'placeholder',
  clientSecret: config.slack.clientSecret || 'placeholder',
  stateSecret: config.slack.stateSecret || 'fallback-secret',
  scopes: [
    'app_mentions:read',
    'channels:history',
    'channels:join', 
    'channels:read',
    'chat:write',
    'chat:write.public',
    'commands',
    'groups:history',
    'groups:read',
    'im:history',
    'im:read',
    'im:write',
    'mpim:history',
    'mpim:read',
    'users:read',
    'assistant:write'
  ],
  installationStore: {
    storeInstallation: saveInstallation,
    fetchInstallation: getInstallation,
    deleteInstallation: deleteInstallation,
  },
  installerOptions: {
    directInstall: true,
  },
});

const app = new App({
  receiver,
  logLevel: LogLevel.INFO
});

registerEvents(app);
registerCommands(app);
registerActions(app);

(async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await app.start({ port, host });
    console.log(`⚡️ Slack + Grok bot running on ${host}:${port} (HTTP Mode)`);

    // Add install success page
    receiver.router.get('/slack/install/success', (req, res) => {
      res.send(`
        <html>
          <head><title>Installation Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🎉 Installation Successful!</h1>
            <p>Your AI Assistant bot has been installed to your Slack workspace.</p>
            <p>You can now:</p>
            <ul style="text-align: left; display: inline-block;">
              <li>Mention @AI Assistant in any channel</li>
              <li>Send direct messages to the bot</li>
              <li>Use the /ask command</li>
              <li>Open the Assistant pane for channel-aware conversations</li>
            </ul>
            <p><a href="slack://open">Open Slack</a></p>
          </body>
        </html>
      `);
    });

    // Add health check endpoint
    receiver.router.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Add root route for testing
    receiver.router.get('/', (req, res) => {
      res.send(`
        <html>
          <head><title>AI Assistant Slack Bot</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🤖 AI Assistant Slack Bot</h1>
            <p>The bot is running successfully!</p>
            <p><strong>Status:</strong> ✅ Online</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <hr>
            <p><a href="/health">Health Check</a></p>
            <p><a href="/slack/install">Install to Slack</a></p>
          </body>
        </html>
      `);
    });

    // Graceful shutdown: clear cached state and close Redis connections
    const shutdown = async (signal) => {
      try {
        console.log(`[shutdown] signal=${signal} — clearing cached state...`);
        await clearAllState();
      } catch (e) {
        console.error('[shutdown] clearAllState error', e);
      }
      try {
        await redis.quit();
      } catch {}
      try {
        await app.stop?.();
      } catch {}
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to start app:', err);
    process.exit(1);
  }
})();
