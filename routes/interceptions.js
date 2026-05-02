const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const User = require('../models/User');

// InterceptionLog is stored inline as a sub-schema for simplicity
const mongoose = require('mongoose');

const interceptionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  domain: { type: String, required: true },
  penalty: { type: Number, default: 5 },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Avoid model re-registration during nodemon hot-reload
const InterceptionLog = mongoose.models.InterceptionLog ||
  mongoose.model('InterceptionLog', interceptionLogSchema);

// POST /api/interceptions/log
router.post('/log', verifyToken, async (req, res, next) => {
  try {
    const { domain, penalty = 5 } = req.body;
    if (!domain) return res.status(400).json({ message: 'domain is required' });

    const log = await InterceptionLog.create({
      userId: req.user.userId,
      domain: domain.trim().toLowerCase(),
      penalty,
      timestamp: new Date()
    });

    // Increment distractionsBlocked counter on user
    await User.findByIdAndUpdate(req.user.userId, { $inc: { distractionsBlocked: 1 } });

    res.status(201).json({ message: 'Interception logged', logId: log._id });
  } catch (error) {
    next(error);
  }
});

// GET /api/interceptions/recent  — last 10 events
router.get('/recent', verifyToken, async (req, res, next) => {
  try {
    const logs = await InterceptionLog.find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .limit(10)
      .select('domain penalty timestamp');

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

// GET /api/interceptions/context  — aggregated distraction context for AI
router.get('/context', verifyToken, async (req, res, next) => {
  try {
    const agg = await InterceptionLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.userId) } },
      { $group: { _id: '$domain', count: { $sum: 1 }, totalPenalty: { $sum: '$penalty' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({ topDistractions: agg });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
