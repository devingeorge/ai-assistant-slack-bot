// Railway-optimized Express server based on common deployment issues
import express from 'express';

const app = express();

// Railway Configuration (critical for deployment)
const port = parseInt(process.env.PORT) || 3000;
const host = '0.0.0.0'; // Railway requirement

console.log('🚂 Railway-Optimized Server Starting...');
console.log(`📍 Port: ${port} (from PORT env: ${process.env.PORT})`);
console.log(`🌐 Host: ${host}`);
console.log(`🔧 Node.js version: ${process.version}`);
console.log('');

// Essential middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (minimal for performance)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Railway Health Check (CRITICAL) - multiple paths
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    port: port,
    uptime: process.uptime()
  });
});

// Alternative health check paths for Railway
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Railway Build Info Endpoint
app.get('/build-info', (req, res) => {
  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development',
    port: port,
    portSource: process.env.PORT ? 'environment' : 'default',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Railway-Optimized Slack Bot</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>🚂 Railway-Optimized Slack Bot</h1>
        <p>✅ <strong>Server is healthy!</strong></p>
        <p><strong>Port:</strong> ${port}</p>
        <p><strong>Uptime:</strong> ${Math.floor(process.uptime())}s</p>
        <p><strong>Node.js:</strong> ${process.version}</p>
        <hr>
        <h3>Endpoints:</h3>
        <ul style="text-align: left; display: inline-block;">
          <li><a href="/health">Health Check</a></li>
          <li><a href="/build-info">Build Info</a></li>
          <li>POST /slack/events</li>
          <li>POST /slack/commands</li>
        </ul>
      </body>
    </html>
  `);
});

// Slack Events (simplified)
app.post('/slack/events', (req, res) => {
  // Handle URL verification
  if (req.body && req.body.challenge) {
    console.log('✅ Slack URL verification');
    return res.json({ challenge: req.body.challenge });
  }
  
  console.log('📩 Slack event received');
  res.status(200).json({ ok: true });
});

// Slack Commands (simplified)
app.post('/slack/commands', (req, res) => {
  console.log('⚡ Slack command received');
  res.json({
    response_type: 'ephemeral',
    text: '🎉 Railway deployment successful! Bot is working.'
  });
});

// Start server with Railway best practices (force IPv4)
const server = app.listen(port, '0.0.0.0', () => {
  const address = server.address();
  console.log('🚂 Railway-Optimized Server READY!');
  console.log(`📍 Listening on: ${address.address}:${address.port}`);
  console.log(`🌐 Public URL: https://ai-assistant-slack-bot-production.up.railway.app`);
  console.log(`⚡ Health check: https://ai-assistant-slack-bot-production.up.railway.app/health`);
});

// Railway error handling
server.on('error', (err) => {
  console.error('🚨 Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown for Railway
const shutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Prevent Railway container from exiting
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  // Don't exit immediately, let Railway handle it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, let Railway handle it
});

console.log('🎯 Server setup complete, waiting for connections...');
