// src/index.js
console.log('🟢 APP STARTING - index.js loaded');

import pkg from '@slack/bolt';
const { App, LogLevel, ExpressReceiver } = pkg;

console.log('🟢 Slack Bolt imported successfully');

import { config } from './config.js';
console.log('🟢 Config imported');

import { registerEvents } from './routes/events.js';
import { registerCommands } from './routes/commands.js'; 
import { registerActions } from './routes/actions.js';
console.log('🟢 Routes imported');

import { clearAllState, redis } from './services/memory.js';
import { getInstallation, saveInstallation, deleteInstallation } from './services/installations.js';
console.log('🟢 Services imported');

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
  endpoints: {
    events: '/slack/events',
    interactive: '/slack/interactive',
    commands: '/slack/commands'
  },
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
  logLevel: LogLevel.DEBUG,
  ignoreSelf: false
});

// Add Slack Bolt middleware to debug what's happening
app.use(async ({ body, payload, next }) => {
  console.log('🔥 Slack Bolt middleware triggered!');
  console.log('📦 Body type:', typeof body);
  console.log('📦 Payload type:', typeof payload);
  if (body) console.log('📦 Body keys:', Object.keys(body));
  if (payload) console.log('📦 Payload keys:', Object.keys(payload));
  await next();
});

registerEvents(app);
registerCommands(app);
registerActions(app);

// Test what's available on the receiver after registration
console.log('🔍 ExpressReceiver routes after setup:', receiver.router.stack?.length || 'Unknown');

// Add a debug route to see what's hitting the server
receiver.router.use((req, res, next) => {
  if (req.path.includes('/slack/')) {
    console.log(`🌐 Request: ${req.method} ${req.path}`);
    
    // Check if this is an interactive request
    if (req.path === '/slack/interactive') {
      console.log('📋 Interactive request headers:', JSON.stringify(req.headers, null, 2));
      console.log('🔑 SLACK_SIGNING_SECRET configured:', !!config.slack.signingSecret);
      console.log('🔑 Signing secret value:', config.slack.signingSecret ? 'PRESENT' : 'MISSING');
    }
  }
  next();
});

// Railway Health Check (CRITICAL) - BEFORE app.start()
receiver.router.get('/health', (req, res) => {
  res.status(200).send('ok');
});

// Alternative health check paths
receiver.router.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

// Root route for testing
receiver.router.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>AI Assistant Slack Bot</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>🤖 AI Assistant Slack Bot</h1>
        <p>✅ <strong>The bot is running successfully!</strong></p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p><a href="/health">Health Check</a></p>
        <p><a href="/slack/install">Install to Slack</a></p>
      </body>
    </html>
  `);
});

(async () => {
  try {
    const port = process.env.PORT || 3000; // Use Railway's port (3000)
    
    // Debug Railway port configuration
    console.log('🚂 Railway Port Debug:');
    console.log(`   PORT environment variable: ${process.env.PORT}`);
    console.log(`   Using port: ${port}`);
    console.log(`   Host: 0.0.0.0 (all IPv4 interfaces)`);
    
    console.log('🚀 Starting Slack Bot server...');
    
    // For Railway, we need to explicitly start the HTTP server
    // Try explicit IPv4 binding to avoid IPv6 conflicts
    await app.start({
      port: port,
      host: '0.0.0.0'  // Back to IPv4 - Slack Bolt might handle IPv6 differently
    });
    
    console.log('✅ Server startup completed successfully!');
    
    console.log(`⚡️ Slack + Grok bot running on 0.0.0.0:${port} (HTTP Mode)`);
    console.log(`🌐 Server should be accessible on all interfaces`);
    console.log(`🔗 URLs should work at: https://ai-assistant-slack-bot-production.up.railway.app`);
    console.log(`🎯 Railway should route traffic to this port: ${port}`);

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

    // Add simple test route first
    receiver.router.get('/test', (req, res) => {
      res.send('Server is working!');
    });

    // Routes should be registered BEFORE app.start(), not after!

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
