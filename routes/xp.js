const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = require('../middleware/auth');

// POST /add-xp
router.post('/add-xp', verifyToken, async (req, res, next) => {
  try {
    const xpToAdd = req.body.xp && req.body.xp > 0 ? req.body.xp : 10;

    // Atomic update using $inc operator
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $inc: { focusXP: xpToAdd } },
      { new: true } // Returns the newly updated document
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentXP = user.focusXP;
    const newLevel = Math.floor(currentXP / 100) + 1;

    // Update level if changed
    if (user.level !== newLevel) {
      user.level = newLevel;
      await user.save();
    }

    const xpToNextLevel = 100 - (currentXP % 100);

    // Keep old response shape for backward compatibility
    res.json({
      message: 'XP added successfully',
      currentXP,
      level: newLevel,
      xpToNextLevel
    });
  } catch (error) {
    next(error); // Pass error to global error handler
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

module.exports = router;
