const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    // 'required: true' ensures that a document cannot be saved to the database unless this field has a value.
    // It acts as a validation layer, throwing an error if the 'username' is missing.
    required: true,
    // 'unique: true' creates a database index that prevents duplicate values for this field across the entire collection.
    // It ensures no two users can register with the same 'username'.
    unique: true
  },
  password: {
    type: String,
    // Ensure that every user has a password. Missing this field will throw a validation error.
    required: true
  },
  focusXP: {
    type: Number,
    default: 0
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  focusCoins: {
    type: Number,
    default: 0
  },
  totalFocusMinutes: {
    type: Number,
    default: 0
  },
  distractionsBlocked: {
    type: Number,
    default: 0
  },
  blockedApps: {
    type: [String],
    default: []
  },
  // Per-user domain blocklist — synced with the Chrome Extension
  blockedSites: {
    type: [String],
    default: []
  },
  level: {
    type: Number,
    default: 1
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  lastFocusDate: {
    type: Date
  },
  hardModeEnabled: {
    type: Boolean,
    default: false
  },
  squadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Squad',
    default: null
  }
});

// Instance method to auto-calculate and update level based on focusXP
userSchema.methods.updateLevel = function() {
  this.level = Math.floor(this.focusXP / 100) + 1;
  return this.level;
};

// Instance method to update streak based on lastFocusDate
userSchema.methods.updateStreak = function() {
  const now = new Date();
  const last = this.lastFocusDate;
  
  if (!last) {
    this.currentStreak = 1;
  } else {
    const diffTime = Math.abs(now - last);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // If it's a new day
    if (now.toDateString() !== last.toDateString()) {
      if (diffDays <= 1) {
        this.currentStreak += 1;
      } else {
        this.currentStreak = 1;
      }
    }
    // If same day, streak remains same
  }
  
  this.lastFocusDate = now;
  return this.currentStreak;
};


module.exports = mongoose.model('User', userSchema);
