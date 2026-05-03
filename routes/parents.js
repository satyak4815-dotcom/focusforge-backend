const express = require('express');
const router = express.Router();
const Parent = require('../models/Parent');
const User = require('../models/User');
const bcrypt = require('bcrypt'); // Ensure bcrypt is installed
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

// POST /api/parents/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if parent already exists
        const existingParent = await Parent.findOne({ $or: [{ username }, { email }] });
        if (existingParent) {
            return res.status(400).json({ message: 'A parent account with this username or email already exists.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const newParent = new Parent({
            username,
            email,
            password: hashedPassword,
            role: 'parent'
        });

        await newParent.save();

        const payload = { userId: newParent._id };
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const parentResponse = newParent.toObject();
        delete parentResponse.password;

        res.status(201).json({ token, user: parentResponse, message: 'Parent registered successfully in parents collection' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/parents/link-child
router.post('/link-child', auth, async (req, res) => {
    try {
        const { username } = req.body;
        const parentId = req.user.userId;

        // 1. Find the child user (Must already exist)
        console.log(`[LinkChild] Searching for kid: ${username}`);
        const child = await User.findOne({
            $or: [
                { username: username },
                { email: username }
            ]
        });

        if (!child) {
            console.log(`[LinkChild] Kid not found: ${username}`);
            return res.status(404).json({ message: `Kid account '${username}' does not exist. Please register the kid account first.` });
        }

        console.log(`[LinkChild] Found kid: ${child.username} (${child._id})`);

        // 2. Link the child to the parent
        const parent = await Parent.findByIdAndUpdate(
            parentId,
            { $addToSet: { children: child._id } },
            { new: true }
        );

        if (!parent) {
            console.log(`[LinkChild] Parent not found: ${parentId}`);
            return res.status(404).json({ message: 'Parent account not found' });
        }

        console.log(`[LinkChild] Successfully linked ${username} to parent ${parentId}`);

        res.json({
            success: true,
            message: `Successfully linked ${username} to your account`,
            children: parent.children
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET /api/parents/linked-children
router.get('/parent/linked-children', auth, async (req, res) => {
    try {
        const parentId = req.user.userId;
        const parent = await Parent.findById(parentId).populate({
            path: 'children',
            select: 'username level focusXP currentStreak'
        });

        if (!parent) {
            return res.status(404).json({ message: 'Parent not found' });
        }

        res.json(parent.children || []);
    } catch (error) {
        res.status(500).json({ message: error.message });
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