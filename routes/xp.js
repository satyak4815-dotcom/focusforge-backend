const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: No token provided' });
  }

  try {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }
    
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    // If it's our internal error (missing secret), pass to global handler
    if (error.message.includes('JWT_SECRET')) {
        return next(error);
    }
    res.status(403).json({ message: 'Invalid or Expired Token' });
  }
};

// POST /add-xp
router.post('/add-xp', verifyToken, async (req, res, next) => {
  try {
    // Atomic update using $inc operator
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $inc: { focusXP: 10 } },
      { new: true } // Returns the newly updated document
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentXP = user.focusXP;
    
    // Dynamic Leveling Math
    // Assuming Level 1 is the base (0-99 XP). At 100 XP, they hit Level 2.
    const level = Math.floor(currentXP / 100) + 1; 
    const xpToNextLevel = 100 - (currentXP % 100);

    res.json({ 
      message: 'XP added successfully', 
      currentXP,
      level,
      xpToNextLevel
    });
  } catch (error) {
    next(error); // Pass error to global error handler
  }
});

module.exports = router;
