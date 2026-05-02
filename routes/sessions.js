const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const FocusSession = require('../models/FocusSession');
const User = require('../models/User');

// POST /api/sessions/start
router.post('/start', verifyToken, async (req, res, next) => {
  try {
    const { domain, durationMins, hardMode } = req.body;

    // Fail any pre-existing active session for this user (safety net)
    await FocusSession.updateMany(
      { userId: req.user.userId, status: 'active' },
      { status: 'failed', endTime: new Date() }
    );

    const session = await FocusSession.create({
      userId: req.user.userId,
      domain: domain || '',
      durationMins: durationMins || 25,
      hardMode: !!hardMode,
      startTime: new Date(),
      status: 'active'
    });

    res.status(201).json({ sessionId: session._id, message: 'Session started' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id/end  — marks the session as complete.
// NOTE: XP and totalFocusMinutes are NO LONGER awarded here.
// They are accumulated atomically via POST /api/xp/add-xp (one call per minute tick).
// Awarding XP here as well would cause double-counting and exponential XP inflation.
router.patch('/:id/end', verifyToken, async (req, res, next) => {
  try {
    const session = await FocusSession.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ message: 'Session is not active' });

    session.status = 'completed';
    session.endTime = new Date();
    // xpEarned is tracked only for record-keeping; XP was already applied per-minute.
    session.xpEarned = Math.floor(session.durationMins);
    await session.save();

    // Only update streak here — XP and minutes are already handled by /add-xp ticks.
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.updateStreak();
    await user.save();

    res.json({
      message: 'Session complete!',
      focusXP: user.focusXP,
      level: user.level,
      currentStreak: user.currentStreak
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/sessions/:id/fail  — session failed, NO XP awarded
router.patch('/:id/fail', verifyToken, async (req, res, next) => {
  try {
    const session = await FocusSession.findOne({
      _id: req.params.id,
      userId: req.user.userId
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    session.status = 'failed';
    session.endTime = new Date();
    session.xpEarned = 0;
    await session.save();

    // Fetch current user XP to return (no change)
    const user = await User.findById(req.user.userId).select('focusXP level');

    res.json({
      message: 'Session failed. No XP awarded.',
      focusXP: user.focusXP,
      level: user.level
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/history  — last 20 sessions
router.get('/history', verifyToken, async (req, res, next) => {
  try {
    const sessions = await FocusSession.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-userId');

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
