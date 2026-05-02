const mongoose = require('mongoose');

const interceptionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FocusSession',
    // Could be null if an interception happened outside an active session, but spec implies it's tied to one
  },
  domain: {
    type: String,
    required: true
  },
  distractionCategory: {
    type: String,
    enum: ['social_media', 'shopping', 'entertainment', 'news', 'other'],
    default: 'other'
  },
  resolved: {
    type: Boolean,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('InterceptionLog', interceptionLogSchema);
