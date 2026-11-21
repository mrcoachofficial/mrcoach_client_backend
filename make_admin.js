const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('./src/models/User');

dotenv.config({ path: path.join(__dirname, '.env') });

const identifier = process.argv[2]?.trim();

const run = async () => {
  if (!identifier) {
    throw new Error('Usage: node make_admin.js list | <email-or-phone>');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in backend/.env.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  if (identifier.toLowerCase() === 'list') {
    const users = await User.find({})
      .select('name email phoneNumber role -_id')
      .lean();
    console.table(users.map(user => ({
      name: user.name || '',
      email: user.email || '',
      phone: user.phoneNumber || '',
      role: user.role || ''
    })));
    return;
  }

  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const user = await User.findOne({
    $or: [
      { email: new RegExp(`^${escapedIdentifier}$`, 'i') },
      { phoneNumber: identifier }
    ]
  });
  if (!user) {
    throw new Error(`No user found for ${identifier}.`);
  }

  user.role = 'admin';
  await user.save();
  console.log(
    `Admin role granted to ${user.name || 'user'} ` +
      `(${user.email || user.phoneNumber || identifier}).`
  );
};

run()
  .catch(error => {
    console.error('Could not make user an admin:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
