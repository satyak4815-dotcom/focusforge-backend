const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const User = require('../models/User');

// GET /api/blocklist  — fetch user's blocked domains from DB
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('blockedSites');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ blockedSites: user.blockedSites || [] });
  } catch (error) {
    next(error);
  }
});

// POST /api/blocklist/add  — append a single domain
router.post('/add', verifyToken, async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      return res.status(400).json({ message: 'domain is required' });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^www\./, '');

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { blockedSites: cleanDomain } }, // addToSet prevents duplicates
      { new: true }
    ).select('blockedSites');

    res.json({ message: 'Domain added', blockedSites: user.blockedSites });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/blocklist/remove  — remove a single domain
router.delete('/remove', verifyToken, async (req, res, next) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ message: 'domain is required' });

    const cleanDomain = domain.trim().toLowerCase().replace(/^www\./, '');

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $pull: { blockedSites: cleanDomain } },
      { new: true }
    ).select('blockedSites');

    res.json({ message: 'Domain removed', blockedSites: user.blockedSites });
  } catch (error) {
    next(error);
  }
});

// PUT /api/blocklist  — replace the entire blocklist
router.put('/', verifyToken, async (req, res, next) => {
  try {
    const { blockedSites } = req.body;
    if (!Array.isArray(blockedSites)) {
      return res.status(400).json({ message: 'blockedSites must be an array' });
    }

    const cleanList = blockedSites.map(s => s.trim().toLowerCase().replace(/^www\./, ''));

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { blockedSites: cleanList },
      { new: true }
    ).select('blockedSites');

    res.json({ message: 'Blocklist updated', blockedSites: user.blockedSites });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
