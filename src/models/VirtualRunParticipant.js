const mongoose = require('mongoose');

const virtualRunParticipantSchema = new mongoose.Schema({
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
    enum: ['joined', 'running', 'completed'],
    default: 'joined'
  },
  currentSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VirtualRunSession',
    default: null
  },
  bestDistanceKm: {
    type: Number,
    default: 0
  },
  bestTimeMs: {
    type: Number,
    default: null
  },
  bestAccuracyMeters: {
    type: Number,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  winnerRewardIssued: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

virtualRunParticipantSchema.index({ eventId: 1, userId: 1 }, { unique: true });
virtualRunParticipantSchema.index({ eventId: 1, status: 1, bestTimeMs: 1 });

module.exports = mongoose.model('VirtualRunParticipant', virtualRunParticipantSchema);
