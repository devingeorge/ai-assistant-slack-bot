// Absolute minimal test to see if Node.js even works
console.log('🔥 MINIMAL TEST STARTING');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

// Test basic HTTP server
import { createServer } from 'http';

console.log('🔥 Creating HTTP server...');

const server = createServer((req, res) => {
  console.log(`🔥 Request: ${req.method} ${req.url}`);
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Minimal test server working!');
  }
});

const port = process.env.PORT || 3000;
console.log(`🔥 Railway PORT env: ${process.env.PORT}`);
console.log(`🔥 Using port: ${port}`);

server.listen(port, '0.0.0.0', () => {
  console.log(`🔥 Minimal server listening on 0.0.0.0:${port}`);
});

console.log('🔥 MINIMAL TEST SETUP COMPLETE');
