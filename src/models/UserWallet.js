const mongoose = require('mongoose');

const userWalletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  currentCoins: {
    type: Number,
    default: 0
  },
  lifetimeCoins: {
    type: Number,
    default: 0
  },
  redeemedCoins: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const UserWallet = mongoose.model('UserWallet', userWalletSchema);
module.exports = UserWallet;
