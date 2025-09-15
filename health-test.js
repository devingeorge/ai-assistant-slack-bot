// Minimal health server to verify Railway works AT ALL
const http = require('http');

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Health test server is working!');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`listening on ${port}`);
});
