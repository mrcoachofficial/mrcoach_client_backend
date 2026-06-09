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

    console.log('Undeleting user with phone "+918825422465"...');
    const result = await User.updateOne(
      { phoneNumber: '+918825422465' },
      { $set: { deleted: false } }
    );

    console.log('Result:', result);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
