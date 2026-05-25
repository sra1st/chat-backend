const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('bunny chat server running');
});

const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', function(ws) {
  ws.roomCode = null;
  ws.userName = null;

  ws.didLeave = false;

  function removeFromRoom(client, code) {
    if (!code || !rooms[code]) return [];
    rooms[code] = rooms[code].filter(function(c) { return c !== client; });
    var remaining = rooms[code].slice();
    if (rooms[code].length === 0) {
      delete rooms[code];
    }
    return remaining;
  }

  function broadcastToRoom(code, payload, exclude) {
    var room = rooms[code] || [];
    room.forEach(function(client) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    });
  }

  function handleLeave(announce) {
    if (!ws.roomCode || !rooms[ws.roomCode] || ws.didLeave) return;
    ws.didLeave = true;
    var code = ws.roomCode;
    var name = ws.userName || 'somebunny';
    var remaining = removeFromRoom(ws, code);
    if (announce && remaining.length > 0) {
      remaining.forEach(function(client) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'left', name: name }));
        }
      });
      broadcastPresence(code);
    }
  }

  ws.on('message', function(data) {
    var msg;
    try { msg = JSON.parse(data.toString()); } catch(e) { return; }

    if (msg.type === 'join') {
      ws.roomCode = msg.code;
      ws.userName = msg.name;
      ws.didLeave = false;
      if (!rooms[ws.roomCode]) rooms[ws.roomCode] = [];
      rooms[ws.roomCode].push(ws);
      broadcastPresence(ws.roomCode);
      broadcastToRoom(ws.roomCode, { type: 'system', text: msg.name + ' hopped in' }, ws);
      return;
    }

    if (msg.type === 'leave') {
      handleLeave(true);
      try { ws.close(); } catch(e) {}
      return;
    }

    if (msg.type === 'message' && ws.roomCode) {
      broadcastToRoom(ws.roomCode, { type: 'message', name: ws.userName, text: msg.text }, ws);
    }
  });

  ws.on('close', function() {
    handleLeave(true);
  });

  ws.on('error', function() {
    if (ws.roomCode && rooms[ws.roomCode]) {
      rooms[ws.roomCode] = rooms[ws.roomCode].filter(function(c) { return c !== ws; });
    }
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
