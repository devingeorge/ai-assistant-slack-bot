// Working Express server with Slack endpoints
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Debug Railway environment
console.log('🔧 Railway Environment Debug:');
console.log(`   PORT: ${process.env.PORT}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`   PWD: ${process.env.PWD}`);
console.log(`   RAILWAY_*: ${JSON.stringify(Object.keys(process.env).filter(k => k.startsWith('RAILWAY')))}`);
console.log('');

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add middleware to log all requests
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

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

// Catch-all route for debugging
app.use('*', (req, res) => {
  console.log(`🔍 Catch-all route hit: ${req.method} ${req.originalUrl}`);
  res.status(200).json({
    message: 'Server is working',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});


// Try different listening approaches
const server = app.listen(port, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  
  const address = server.address();
  console.log(`🚀 Express server running!`);
  console.log(`📍 Address: ${JSON.stringify(address)}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 Port from env: ${process.env.PORT}`);
  console.log(`🔗 Available endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   POST /slack/events`);
  console.log(`   POST /slack/commands`);
  console.log(`   GET  /slack/oauth_redirect`);
  console.log(`📡 Should be accessible at: https://ai-assistant-slack-bot-production.up.railway.app`);
});

// Add error handling for the server
server.on('error', (err) => {
  console.error('🚨 Server error:', err);
});

server.on('listening', () => {
  console.log('✅ Server is now listening for connections');
  
  // Self-test the health endpoint
  const address = server.address();
  console.log(`🔍 Self-testing health endpoint...`);
  
  import('http').then(({ default: http }) => {
    const healthReq = http.request({
      hostname: 'localhost',
      port: address.port,
      path: '/health',
      method: 'GET'
    }, (res) => {
      console.log(`✅ Self-test result: ${res.statusCode}`);
      res.on('data', (chunk) => {
        console.log(`📄 Response: ${chunk}`);
      });
    });
    
    healthReq.on('error', (err) => {
      console.log(`❌ Self-test failed: ${err.message}`);
    });
    
    healthReq.end();
  });
});
