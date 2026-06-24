const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('../src/models/User');
const UserWallet = require('../src/models/UserWallet');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const targetNumber = '8825422465';
    const formats = [targetNumber, `+91${targetNumber}`, `91${targetNumber}`];
    
    let user = null;
    for (const phone of formats) {
      user = await User.findOne({ phoneNumber: phone });
      if (user) {
        console.log(`Found user matching phone: ${phone}`);
        break;
      }
    }

    if (!user) {
      console.log('User not found with phone number 8825422465 (or +918825422465).');
      return;
    }

    console.log('User ID:', user._id);
    console.log('User Name:', user.name);

    let wallet = await UserWallet.findOne({ userId: user._id });
    if (!wallet) {
      console.log('Wallet not found, creating new wallet...');
      wallet = new UserWallet({
        userId: user._id,
        currentCoins: 10000,
        lifetimeCoins: 10000,
        redeemedCoins: 0
      });
    } else {
      console.log('Existing wallet details:', wallet);
      wallet.currentCoins = 10000;
      wallet.lifetimeCoins = Math.max(wallet.lifetimeCoins, 10000);
    }

    await wallet.save();
    console.log('Successfully updated wallet coins balance to 10000!');
    console.log('Updated Wallet:', wallet);

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
