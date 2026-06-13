const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Weekly', 'Monthly'],
    required: true
  },
  activityType: {
    type: String,
    required: true
  },
  target: {
    type: Number, // distance target in km (e.g. 15 for Weekly Walking, 60 for Monthly Walking)
    required: true
  },
  rewardCoins: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Challenge = mongoose.model('Challenge', challengeSchema);
module.exports = Challenge;
