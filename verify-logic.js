
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Parent = require('./models/Parent');

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Create a dummy kid if not exists
        let kid = await User.findOne({ username: 'test_kid' });
        if (!kid) {
            kid = new User({ username: 'test_kid', email: 'test_kid@example.com', password: 'password' });
            await kid.save();
            console.log('Created test_kid');
        }

        // 2. Create a dummy parent
        const parent = new Parent({ username: 'test_parent', email: 'test_parent@example.com', password: 'password' });
        await parent.save();
        console.log('Created test_parent');

        // 3. Link them
        parent.children.push(kid._id);
        await parent.save();
        console.log('Linked kid to parent');

        const updatedParent = await Parent.findById(parent._id).populate('children');
        console.log('Updated Parent Children Count:', updatedParent.children.length);
        console.log('Child Username:', updatedParent.children[0].username);

        // Cleanup
        await Parent.deleteOne({ _id: parent._id });
        console.log('Cleaned up parent');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
