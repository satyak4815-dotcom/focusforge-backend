require('dotenv').config();
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const http      = require('http');
const WebSocket = require('ws');
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');

const app    = express();
const server = http.createServer(app); // Wrap Express so WS can share the same port

// ─── WebSocket Server (Squad Sync) ───────────────────────────────────────────
// Attached to the HTTP server — NOT a separate port.
const wss = new WebSocket.Server({ server });

// rooms: { "ABCD": { users: { "userId": { name, status, xp, ws } } } }
const rooms = {};

function broadcastRoomState(roomId) {
  if (!rooms[roomId]) return;

  const room = rooms[roomId];
  const publicUsers = Object.keys(room.users).map(userId => ({
    id:     userId,
    name:   room.users[userId].name,
    status: room.users[userId].status,
    xp:     room.users[userId].xp,
  }));

  const statePayload = JSON.stringify({ type: 'room_state', users: publicUsers });

  Object.values(room.users).forEach(user => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(statePayload);
    }
  });
}

wss.on('connection', (ws) => {
  let currentUser = { id: null, roomId: null };

  ws.on('message', (messageAsString) => {
    try {
      const data   = JSON.parse(messageAsString);
      const action = data.action;

      if (action === 'host') {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const userId = Math.random().toString(36).substring(2, 10);

        rooms[roomId] = {
          users: {
            [userId]: { name: data.name, status: 'idle', xp: data.xp || 0, ws },
          },
        };

        currentUser = { id: userId, roomId };
        ws.send(JSON.stringify({ type: 'hosted', roomId, userId }));
        broadcastRoomState(roomId);

      } else if (action === 'join') {
        const roomId = data.roomId.toUpperCase();
        if (!rooms[roomId]) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }

        const userId = Math.random().toString(36).substring(2, 10);
        rooms[roomId].users[userId] = { name: data.name, status: 'idle', xp: data.xp || 0, ws };

        currentUser = { id: userId, roomId };
        ws.send(JSON.stringify({ type: 'joined', roomId, userId }));
        broadcastRoomState(roomId);

      } else if (action === 'update_state') {
        if (!currentUser.roomId || !rooms[currentUser.roomId]) return;

        const userRecord = rooms[currentUser.roomId].users[currentUser.id];
        if (userRecord) {
          if (data.status !== undefined) userRecord.status = data.status;
          if (data.xp     !== undefined) userRecord.xp     = data.xp;
          broadcastRoomState(currentUser.roomId);
        }

      } else if (action === 'leave') {
        if (currentUser.roomId && rooms[currentUser.roomId]) {
          delete rooms[currentUser.roomId].users[currentUser.id];
          broadcastRoomState(currentUser.roomId);
          if (Object.keys(rooms[currentUser.roomId].users).length === 0) {
            delete rooms[currentUser.roomId];
          }
        }
        currentUser = { id: null, roomId: null };
      }

    } catch (e) {
      console.error('Squad WS: error processing message', e);
    }
  });

  ws.on('close', () => {
    if (currentUser.roomId && rooms[currentUser.roomId]) {
      delete rooms[currentUser.roomId].users[currentUser.id];
      broadcastRoomState(currentUser.roomId);
      if (Object.keys(rooms[currentUser.roomId].users).length === 0) {
        delete rooms[currentUser.roomId];
      }
    }
  });
});

// ─── Express Middlewares ──────────────────────────────────────────────────────

// Dynamic CORS policy — add your published extension ID to EXTENSION_ID env var before deploying.
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',  // Vite dev server (web dashboard)
  `chrome-extension://${process.env.EXTENSION_ID || 'YOUR_EXTENSION_ID_HERE'}`,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const xpRoutes          = require('./routes/xp');
const sessionRoutes     = require('./routes/sessions');
const blocklistRoutes   = require('./routes/blocklist');
const interceptionRoutes = require('./routes/interceptions');
const squadRoutes       = require('./routes/squads');

// ─── Route Wiring ─────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/user',          xpRoutes);
app.use('/api/sessions',      sessionRoutes);
app.use('/api/blocklist',     blocklistRoutes);
app.use('/api/interceptions', interceptionRoutes);
app.use('/api/squads',        squadRoutes);

// Health-check / root
app.get('/', (req, res) => {
  res.json({ message: 'FocusForge API is officially running!' });
});

// ─── Database Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
  })
  .catch((error) => {
    console.log('❌ MongoDB Connection Failed:', error.message);
    console.log('Diagnosis Info - Code:', error.code, 'Hostname:', error.hostname);
  });

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// ─── Start (HTTP + WS on the same port) ──────────────────────────────────────
// Render injects process.env.PORT automatically. Falls back to 3000 for local dev.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 HTTP + WebSocket server listening on port ${PORT}`);
});