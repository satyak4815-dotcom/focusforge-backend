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
  }
});

module.exports = mongoose.model('User', userSchema);
