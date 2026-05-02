require('dotenv').config();
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 1. Middlewares (The Bouncers)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// 2. Import Your New Routes (Plugging them in)
const authRoutes = require('./routes/auth');
const xpRoutes = require('./routes/xp');
const sessionRoutes = require('./routes/sessions');
const blocklistRoutes = require('./routes/blocklist');
const interceptionRoutes = require('./routes/interceptions');
const squadRoutes = require('./routes/squads');

// 3. Route Wiring (The Signposts)
app.use('/api/auth', authRoutes);
app.use('/api/user', xpRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/blocklist', blocklistRoutes);
app.use('/api/interceptions', interceptionRoutes);
app.use('/api/squads', squadRoutes);

// 4. Test Route (To check if the API is awake)
app.get('/', (req, res) => {
    res.json({ message: 'FocusForge API is officially running!' });
});

// 5. Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Atlas Connected Successfully!');
    })
    .catch((error) => {
        console.log('❌ MongoDB Connection Failed:', error.message);
        console.log('Diagnosis Info - Code:', error.code, 'Hostname:', error.hostname);
    });

// 6. Global Error-Handling Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// 7. Start the Engine
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is listening on port ${PORT}`);
});