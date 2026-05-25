const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('bunny chat server running');
});

const wss = new WebSocket.Server({ server });

const rooms = {};

function removeClientFromRoom(ws, announceLeave) {
  if (!ws.roomCode || !rooms[ws.roomCode]) return;
  if (ws._removedFromRoom) return;
  ws._removedFromRoom = true;

  var roomCode = ws.roomCode;
  var room = rooms[roomCode];
  rooms[roomCode] = room.filter(function(c) { return c !== ws; });

  if (announceLeave && ws.userName && rooms[roomCode].length > 0) {
    rooms[roomCode].forEach(function(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'left', name: ws.userName }));
      }
    });
  }

  if (rooms[roomCode].length === 0) {
    delete rooms[roomCode];
  } else {
    broadcastPresence(roomCode);
  }
}

wss.on('connection', function(ws) {
  ws.roomCode = null;
  ws.userName = null;
  ws._removedFromRoom = false;

  ws.on('message', function(data) {
    var msg;
    try { msg = JSON.parse(data.toString()); } catch(e) { return; }

    if (msg.type === 'join') {
      ws.roomCode = msg.code;
      ws.userName = msg.name;
      ws._removedFromRoom = false;
      if (!rooms[ws.roomCode]) rooms[ws.roomCode] = [];

      // Avoid duplicate joins if the client reconnects/re-sends.
      if (rooms[ws.roomCode].indexOf(ws) === -1) {
        rooms[ws.roomCode].push(ws);
      }

      broadcastPresence(ws.roomCode);

      // notify others
      rooms[ws.roomCode].forEach(function(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'system', text: msg.name + ' hopped in' }));
        }
      });
      return;
    }

    if (msg.type === 'leave') {
      removeClientFromRoom(ws, true);
      return;
    }

    if (msg.type === 'message' && ws.roomCode) {
      var room = rooms[ws.roomCode] || [];
      room.forEach(function(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'message', name: ws.userName, text: msg.text }));
        }
      });
    }
  });

  ws.on('close', function() {
    removeClientFromRoom(ws, true);
  });

  ws.on('error', function() {
    removeClientFromRoom(ws, false);
  });
});

function broadcastPresence(roomCode) {
  var room = rooms[roomCode] || [];
  var count = room.length;
  room.forEach(function(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'presence', count: count }));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Server listening on port ' + PORT);
});

// Keep-alive ping every 10 mins to prevent Render free tier spin-down
setInterval(function() {
  https.get('https://chat-backend-2ri0.onrender.com', function(res) {
    console.log('Keep-alive ping:', res.statusCode);
  }).on('error', function(e) {
    console.log('Ping error:', e.message);
  });
}, 10 * 60 * 1000);
