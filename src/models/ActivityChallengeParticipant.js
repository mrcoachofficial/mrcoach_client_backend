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
  status: {
    type: String,
    enum: ['joined', 'completed'],
    default: 'joined'
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

schema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ActivityChallengeParticipant', schema);
