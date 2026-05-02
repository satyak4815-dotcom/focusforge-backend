// ─── Environment & Initialization ─────────────────────────────────────────────
require('dotenv').config();
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first'); // Fix for MongoDB local resolution issues

const http      = require('http');
const WebSocket = require('ws');
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');

const app    = express();
const server = http.createServer(app); // Unified server for HTTP and WebSockets

// ─── WebSocket Layer (Real-time Squad Sync) ──────────────────────────────────
/**
 * Attached to the HTTP server to share the same port.
 * Manages volatile, in-memory rooms for live focus synchronization.
 */
const wss = new WebSocket.Server({ server });

// In-memory room store: { [roomId]: { users: { [userId]: { name, status, xp, ws } } } }
const rooms = {};

/**
 * Broadcasts the current state of a room to all connected participants.
 * @param {string} roomId 
 */
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

// ─── Express Middleware Configuration ─────────────────────────────────────────

// Dynamic CORS policy — optimized for Local Dev, Dashboards, and Chrome Extensions
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',  // Vite dev server
  process.env.FRONTEND_URL, // Production dashboard
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests
    if (!origin) return callback(null, true);

    // Allow explicit domains
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any Chrome Extension (crucial for side-loading & team dev)
    if (origin.startsWith('chrome-extension://')) return callback(null, true);

    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ─── Route Controller Wiring ──────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const xpRoutes           = require('./routes/xp');
const sessionRoutes      = require('./routes/sessions');
const blocklistRoutes    = require('./routes/blocklist');
const interceptionRoutes = require('./routes/interceptions');
const squadRoutes        = require('./routes/squads');
const appsRoutes         = require('./routes/apps');


app.use('/api/auth',          authRoutes);
app.use('/api/user',          xpRoutes);
app.use('/api/sessions',      sessionRoutes);
app.use('/api/blocklist',     blocklistRoutes);
app.use('/api/interceptions', interceptionRoutes);
app.use('/api/squads',        squadRoutes);
app.use('/api/apps',          appsRoutes);


// System Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'FocusForge Unified API is running.',
    timestamp: new Date().toISOString()
  });
});

// ─── Database Connectivity ────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas Connected Successfully!');
  })
  .catch((error) => {
    console.log('❌ MongoDB Connection Failed:', error.message);
  });

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Internal Server Error' 
  });
});

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Unified HTTP + WebSocket server listening on port ${PORT}`);
});