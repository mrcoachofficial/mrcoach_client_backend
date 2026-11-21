const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rewardCoins: {
    type: Number,
    required: true,
    min: 0
  },
  badgeName: {
    type: String,
    default: ''
  },
  settledAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

schema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ActivityChallengeRewardSettlement', schema);
