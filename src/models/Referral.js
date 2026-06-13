const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['INVITED', 'SIGNED_UP', 'BOOKING_COMPLETED', 'REWARDED'],
    default: 'SIGNED_UP'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  rewardAmount: {
    type: Number,
    default: 0
  },
  rewardedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Ensure a user can only be referred once
referralSchema.index({ referredUser: 1 }, { unique: true });

referralSchema.post('save', async function(doc) {
  // If referral status changed to REWARDED, award 100 coins to referrer
  if (doc.status === 'REWARDED') {
    try {
      const UserWallet = mongoose.model('UserWallet');
      const CoinTransaction = mongoose.model('CoinTransaction');
      
      let referrerWallet = await UserWallet.findOne({ userId: doc.referrer });
      if (!referrerWallet) {
        referrerWallet = await UserWallet.create({ userId: doc.referrer });
      }
      
      // Check if already rewarded with coins for this referral to prevent double crediting
      const desc = `Referral coins for inviting user ID: ${doc.referredUser}`;
      const exists = await CoinTransaction.findOne({
        userId: doc.referrer,
        description: desc
      });
      
      if (!exists) {
        referrerWallet.currentCoins += 100;
        referrerWallet.lifetimeCoins += 100;
        await referrerWallet.save();
        
        await CoinTransaction.create({
          userId: doc.referrer,
          type: 'earn',
          coins: 100,
          description: desc
        });
      }
    } catch (err) {
      console.error('Error awarding referral coins in post-save hook:', err);
    }
  }
});

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;

