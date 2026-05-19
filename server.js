const http = require('http');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chat server is running');
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', function(ws) {
  clients.push(ws);
  console.log('New connection. Total clients:', clients.length);

  ws.on('message', function(data) {
    const message = data.toString();
    console.log('Message received:', message);
    // Send to all OTHER clients
    clients.forEach(function(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', function() {
    clients = clients.filter(function(c) { return c !== ws; });
    console.log('Client disconnected. Total clients:', clients.length);
  });

  ws.on('error', function(err) {
    console.log('WebSocket error:', err);
    clients = clients.filter(function(c) { return c !== ws; });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Server listening on port ' + PORT);
});
