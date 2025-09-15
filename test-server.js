// Working Express server with Slack endpoints
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>AI Assistant Slack Bot</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>🤖 AI Assistant Slack Bot</h1>
        <p>✅ <strong>Server is working!</strong></p>
        <p><strong>Status:</strong> Online</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p><a href="/health">Health Check</a></p>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Slack event endpoint
app.post('/slack/events', (req, res) => {
  console.log('📩 Slack event received:', req.body);
  
  // Handle Slack URL verification challenge
  if (req.body.challenge) {
    console.log('✅ Responding to Slack challenge');
    return res.json({ challenge: req.body.challenge });
  }
  
  // For now, just acknowledge the event
  res.status(200).json({ ok: true });
});

// Slack OAuth redirect
app.get('/slack/oauth_redirect', (req, res) => {
  res.send('OAuth redirect received - integration coming soon!');
});

// Slack commands
app.post('/slack/commands', (req, res) => {
  console.log('⚡ Slack command received:', req.body);
  res.json({ 
    response_type: 'ephemeral',
    text: 'Bot is working! Full AI integration coming soon...' 
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Express server with Slack endpoints running on 0.0.0.0:${port}`);
  console.log(`🔗 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /slack/events`);
  console.log(`   POST /slack/commands`);
  console.log(`   GET  /slack/oauth_redirect`);
});
