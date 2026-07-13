const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://2kamalesh0809_db_user:Geethaamma0809@cluster0.nrlmzup.mongodb.net/mrcoach?appName=Cluster0';
    await mongoose.connect(mongoUri);

    const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
    const User = mongoose.model('User', UserSchema);

    const users = await User.find({}, 'email name role');
    const emails = users.map(u => ({
      name: u.get('name'),
      email: u.get('email'),
      role: u.get('role')
    })).filter(u => u.email);

    console.log(JSON.stringify(emails, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
