const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Parent = require('../models/Parent');

// POST /register - Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Input Validation
    if (!username || !email || !password || username.trim() === '' || email.trim() === '' || password.trim() === '') {
      return res.status(400).json({ message: 'Username, email, and password cannot be empty' });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this username or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
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
    const { identifier, username, password } = req.body;
    const loginIdentifier = identifier || username; // Support both 'identifier' and legacy 'username' field

    // Input Validation
    if (!loginIdentifier || !password || loginIdentifier.trim() === '' || password.trim() === '') {
      return res.status(400).json({ message: 'Identifier and password cannot be empty' });
    }

    const isEmail = loginIdentifier.includes('@');
    const query = isEmail ? { email: loginIdentifier } : { username: loginIdentifier };

    let user = await User.findOne(query);
    let isParent = false;
    
    if (!user) {
      user = await Parent.findOne(query);
      isParent = true;
    }

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

// GET /profile - Fetch current user profile
router.get('/profile', require('../middleware/auth'), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
