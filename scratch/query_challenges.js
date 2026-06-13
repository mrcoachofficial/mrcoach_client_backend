const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Challenge = require('../src/models/Challenge');

async function run() {
  try {
    console.log('Connecting to MongoDB: ' + process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const challenges = await Challenge.find({});
    console.log(`Found ${challenges.length} challenges:`);
    challenges.forEach(c => {
      console.log(`- [${c._id}] Title: "${c.title}", Target: ${c.target}, Reward: ${c.rewardCoins}, Active: ${c.isActive}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
