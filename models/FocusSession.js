const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  domain: {
    type: String,
    default: ''
  },
  durationMins: {
    type: Number,
    default: 25
  },
  hardMode: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  status: {
    // 'completed' = full success, 'failed' = manual stop or hard mode violation
    type: String,
    enum: ['active', 'completed', 'failed'],
    default: 'active'
  },
  xpEarned: {
    type: Number,
    default: 0
  },
  distractionsHit: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('FocusSession', focusSessionSchema);

