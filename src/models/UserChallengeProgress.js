const mongoose = require('mongoose');

const userChallengeProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  challengeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge',
    required: true
  },
  progress: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'claimed'],
    default: 'active'
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

const UserChallengeProgress = mongoose.model('UserChallengeProgress', userChallengeProgressSchema);
module.exports = UserChallengeProgress;
