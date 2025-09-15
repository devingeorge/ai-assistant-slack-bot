// Minimal Express server that bypasses Slack Bolt entirely
import express from 'express';
import crypto from 'crypto';

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Basic Slack signature verification (simplified)
function verifySlackSignature(req, res, next) {
  const signature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-timestamp'];
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  
  if (!signature || !timestamp || !signingSecret) {
    console.log('⚠️ Missing Slack signature/timestamp/secret - allowing for now');
    return next();
  }
  
  // For now, just log and continue - we'll implement proper verification later
  console.log('🔐 Slack signature present, skipping verification for debugging');
  next();
}

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Minimal Express + Slack Bot</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>🚀 Minimal Express + Slack Bot</h1>
        <p>✅ <strong>Server is working!</strong></p>
        <p><strong>Status:</strong> Online</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr>
        <h3>Available Endpoints:</h3>
        <ul style="text-align: left; display: inline-block;">
          <li><a href="/health">GET /health</a> - Health check</li>
          <li>POST /slack/events - Slack events</li>
          <li>POST /slack/commands - Slack commands</li>
          <li>GET /slack/oauth_redirect - OAuth redirect</li>
        </ul>
      </body>
    </html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'minimal-express',
    version: '1.0.0'
  });
});

// Slack events endpoint
app.post('/slack/events', verifySlackSignature, (req, res) => {
  console.log('📩 Slack event received:', JSON.stringify(req.body, null, 2));
  
  // Handle URL verification challenge
  if (req.body.challenge) {
    console.log('✅ Responding to Slack challenge:', req.body.challenge);
    return res.json({ challenge: req.body.challenge });
  }
  
  // Handle actual events
  if (req.body.event) {
    console.log('⚡ Event type:', req.body.event.type);
    console.log('👤 User:', req.body.event.user);
    console.log('💬 Text:', req.body.event.text);
    console.log('📍 Channel:', req.body.event.channel);
  }
  
  // Always acknowledge quickly
  res.status(200).json({ ok: true });
});

// Slack commands endpoint  
app.post('/slack/commands', verifySlackSignature, (req, res) => {
  console.log('⚡ Slack command received:', JSON.stringify(req.body, null, 2));
  
  res.json({
    response_type: 'ephemeral',
    text: `🎉 Minimal server received your command: ${req.body.command || 'unknown'}\n\nText: ${req.body.text || 'none'}\n\nServer working perfectly!`
  });
});

// OAuth redirect endpoint
app.get('/slack/oauth_redirect', (req, res) => {
  console.log('🔐 OAuth redirect:', req.query);
  res.send(`
    <html>
      <head><title>OAuth Success</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>🎉 OAuth Redirect Received!</h1>
        <p>Code: ${req.query.code || 'none'}</p>
        <p>State: ${req.query.state || 'none'}</p>
        <p><a href="/">Back to Home</a></p>
      </body>
    </html>
  `);
});

// Test endpoint for manual testing
app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    headers: req.headers,
    query: req.query
  });
});

// Catch-all for debugging (use proper syntax)
app.all('*', (req, res) => {
  console.log(`🔍 Catch-all: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Not found',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Minimal Express server running on 0.0.0.0:${port}`);
  console.log(`📍 Address: ${JSON.stringify(server.address())}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 PORT from env: ${process.env.PORT}`);
  console.log(`📡 Should be accessible at: https://ai-assistant-slack-bot-production.up.railway.app`);
});

server.on('error', (err) => {
  console.error('🚨 Server error:', err);
});

server.on('listening', () => {
  console.log('✅ Server is listening and ready for connections');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
