const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /register - Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Input Validation
    if (!username || !password || username.trim() === '' || password.trim() === '') {
      return res.status(400).json({ message: 'Username and password cannot be empty' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      password: hashedPassword
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    next(error); // Pass error to global error handler
  }
});

// POST /login - Authenticate a user and issue a JWT
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Input Validation
    if (!username || !password || username.trim() === '' || password.trim() === '') {
      return res.status(400).json({ message: 'Username and password cannot be empty' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const payload = {
      userId: user._id
    };

    // Strict JWT Secret handling
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Remove password from user object before returning
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ token, user: userResponse, message: 'Logged in successfully' });
  } catch (error) {
    next(error); // Pass error to global error handler
  }
});

module.exports = router;
