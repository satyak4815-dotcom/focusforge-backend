const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const User = require('../models/User');

// GET /api/apps — fetch user's blocked apps from DB
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('blockedApps');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ blockedApps: user.blockedApps || [] });
  } catch (error) {
    next(error);
  }
});

// POST /api/apps/add — append a single package name
router.post('/add', verifyToken, async (req, res, next) => {
  try {
    const { packageName } = req.body;
    if (!packageName || !packageName.trim()) {
      return res.status(400).json({ message: 'packageName is required' });
    }

    const cleanPackageName = packageName.trim();

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { blockedApps: cleanPackageName } },
      { new: true }
    ).select('blockedApps');

    res.json({ message: 'App added to blocklist', blockedApps: user.blockedApps });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/apps/remove — remove a single package name
router.delete('/remove', verifyToken, async (req, res, next) => {
  try {
    const { packageName } = req.body;
    if (!packageName) return res.status(400).json({ message: 'packageName is required' });

    const cleanPackageName = packageName.trim();

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $pull: { blockedApps: cleanPackageName } },
      { new: true }
    ).select('blockedApps');

    res.json({ message: 'App removed from blocklist', blockedApps: user.blockedApps });
  } catch (error) {
    next(error);
  }
});

// PUT /api/apps — replace the entire blocked apps list
router.put('/', verifyToken, async (req, res, next) => {
  try {
    const { blockedApps } = req.body;
    if (!Array.isArray(blockedApps)) {
      return res.status(400).json({ message: 'blockedApps must be an array' });
    }

    const cleanList = blockedApps.map(app => app.trim());

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { blockedApps: cleanList },
      { new: true }
    ).select('blockedApps');

    res.json({ message: 'Blocked apps list updated', blockedApps: user.blockedApps });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
