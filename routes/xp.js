const express = require('express');
const router = express.Router();
const User = require('../models/User');

const verifyToken = require('../middleware/auth');

// POST /add-xp
// Expects { xpDelta: <positive integer> } — always send a strict 1-unit delta per minute tick.
// The `xp` key is accepted as a fallback for backward compatibility.
// The backend uses MongoDB's $inc operator so this endpoint is safe to call repeatedly;
// sending cumulative totals instead of deltas WILL cause exponential XP inflation.
router.post('/add-xp', verifyToken, async (req, res, next) => {
  try {
    // Accept xpDelta (new canonical key) or xp (legacy fallback)
    const raw = req.body.xpDelta ?? req.body.xp;
    const xpToAdd = parseInt(raw, 10);

    if (!xpToAdd || xpToAdd <= 0) {
      return res.status(400).json({
        message: 'xpDelta must be a positive integer (e.g. { xpDelta: 1 }). ' +
                 'Send a per-tick delta, never a cumulative total.'
      });
    }

    // Single atomic operation: increment XP and focus minutes together.
    // This prevents the double-award bug where session /end also added XP.
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: {
          focusXP: xpToAdd,
          totalFocusMinutes: xpToAdd  // 1 XP == 1 minute, so delta doubles as minute count
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentXP = user.focusXP;
    const newLevel = Math.floor(currentXP / 100) + 1;

    // Update level if it changed — requires a second write but only happens on level-up
    if (user.level !== newLevel) {
      user.level = newLevel;
      await user.save();
    }

    const xpToNextLevel = 100 - (currentXP % 100);

    res.json({
      message: 'XP added successfully',
      currentXP,
      level: newLevel,
      xpToNextLevel
    });
  } catch (error) {
    next(error);
  }
});

// POST /deduct-xp
router.post('/deduct-xp', verifyToken, async (req, res, next) => {
  try {
    const xpToDeduct = req.body.xp && req.body.xp > 0 ? req.body.xp : 0;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let newXP = user.focusXP - xpToDeduct;
    if (newXP < 0) newXP = 0;

    user.focusXP = newXP;
    user.updateLevel();
    await user.save();

    // New endpoint, use standard success format
    res.json({
      success: true,
      data: {
        focusXP: user.focusXP,
        level: user.level
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /profile
router.get('/profile', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      username: user.username,
      email: user.email,
      focusXP: user.focusXP,
      focusCoins: user.focusCoins,
      totalFocusMinutes: user.totalFocusMinutes,
      distractionsBlocked: user.distractionsBlocked,
      blockedApps: user.blockedApps,
      blockedSites: user.blockedSites || []
    });
  } catch (error) {
    next(error);
  }
});

// GET /stats
router.get('/stats', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      focusXP: user.focusXP,
      focusCoins: user.focusCoins,
      totalFocusMinutes: user.totalFocusMinutes,
      distractionsBlocked: user.distractionsBlocked
    });
  } catch (error) {
    next(error);
  }
});

// GET /all-users
// Fetches all users from the User collection (password excluded).
// Auth intentionally disabled for temporary testing.
router.get('/all-users', async (req, res, next) => {
  try {
    const users = await User.find({})
      .select('-password')
      .sort({ _id: -1 });

    res.json({
      total: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
