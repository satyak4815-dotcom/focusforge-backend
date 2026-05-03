const express = require('express');
const router = express.Router();
const Parent = require('../models/Parent');
const User = require('../models/User');
const bcrypt = require('bcrypt'); // Ensure bcrypt is installed

// POST /api/parents/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newParent = new Parent({
            username,
            email,
            password: hashedPassword,
            role: 'parent'
        });

        await newParent.save();
        res.status(201).json({ success: true, message: 'Parent registered successfully in parents collection' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/parents/child-activity
router.get('/child-activity', async (req, res) => {
    try {
        const { kidId } = req.query;
        const child = await User.findById(kidId);
        if (!child) return res.status(404).json({ message: 'Child not found' });

        // Return the visitedWebsites array from the User model
        res.json(child.visitedWebsites || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;