const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('User', UserSchema);

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://2kamalesh0809_db_user:Geethaamma0809@cluster0.nrlmzup.mongodb.net/mrcoach?appName=Cluster0';
    console.log('Connecting to URI:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    console.log('Fetching all users in the collection...');
    const users = await User.find({});

    console.log(`Found ${users.length} matching users:`);
    users.forEach(u => {
      console.log(u.toObject());
    });

    // Count all users
    const total = await User.countDocuments({});
    console.log('Total users in collection:', total);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
