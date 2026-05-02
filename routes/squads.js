const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const Squad = require('../models/Squad');
const User = require('../models/User');

// Helper to generate 5-digit code
function generateJoinCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// POST /api/squads/create
router.post('/create', verifyToken, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Squad name is required' });

    const joinCode = generateJoinCode();
    
    const squad = await Squad.create({
      name,
      joinCode,
      createdBy: req.user.userId,
      members: [{ userId: req.user.userId }]
    });

    // Update user's squadId
    await User.findByIdAndUpdate(req.user.userId, { squadId: squad._id });

    res.status(201).json(squad);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Squad name already exists' });
    }
    next(error);
  }
});

// POST /api/squads/join
router.post('/join', verifyToken, async (req, res, next) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ message: 'Join code is required' });

    const squad = await Squad.findOne({ joinCode });
    if (!squad) return res.status(404).json({ message: 'Squad not found' });

    // Check if already a member
    const isMember = squad.members.some(m => m.userId.toString() === req.user.userId);
    if (!isMember) {
      squad.members.push({ userId: req.user.userId });
      await squad.save();
    }

    // Update user's squadId
    await User.findByIdAndUpdate(req.user.userId, { squadId: squad._id });

    res.json(squad);
  } catch (error) {
    next(error);
  }
});

// GET /api/squads/:id/leaderboard
router.get('/:id/leaderboard', verifyToken, async (req, res, next) => {
  try {
    const squad = await Squad.findById(req.params.id);
    if (!squad) return res.status(404).json({ message: 'Squad not found' });

    // Fetch all members' details
    const memberIds = squad.members.map(m => m.userId);
    const users = await User.find({ _id: { $in: memberIds } })
      .select('username focusXP totalFocusMinutes')
      .sort({ focusXP: -1 });

    // Map live status from squad members array
    const leaderboard = users.map(u => {
      const squadMember = squad.members.find(m => m.userId.toString() === u._id.toString());
      return {
        memberId: u._id,
        username: u.username,
        focusXP: u.focusXP,
        totalFocusMinutes: u.totalFocusMinutes,
        isLive: squadMember ? squadMember.isLive : false
      };
    });

    res.json({ 
      leaderboard,
      squadName: squad.name,
      joinCode: squad.joinCode
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/squads/live-status
router.patch('/live-status', verifyToken, async (req, res, next) => {
  try {
    const { isLive } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user || !user.squadId) return res.status(400).json({ message: 'No squad joined' });

    await Squad.updateOne(
      { _id: user.squadId, 'members.userId': req.user.userId },
      { $set: { 'members.$.isLive': isLive } }
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/squads/leave
router.delete('/leave', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.squadId) return res.status(400).json({ message: 'No squad joined' });

    await Squad.updateOne(
      { _id: user.squadId },
      { $pull: { members: { userId: req.user.userId } } }
    );

    user.squadId = undefined;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
