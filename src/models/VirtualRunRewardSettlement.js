const mongoose = require('mongoose');

const virtualRunRewardSettlementSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    unique: true
  },
  winnerParticipantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VirtualRunParticipant',
    default: null
  },
  winnerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  winnerName: {
    type: String,
    default: ''
  },
  completionTimeMs: {
    type: Number,
    default: null
  },
  gpsAccuracyMeters: {
    type: Number,
    default: null
  },
  distanceKm: {
    type: Number,
    default: null
  },
  rewardType: {
    type: String,
    enum: ['voucher', 'discount', 'coins', 'manual', 'none'],
    required: true
  },
  rewardValue: {
    type: Number,
    default: 0
  },
  rewardDescription: {
    type: String,
    default: ''
  },
  rewardReference: {
    type: String,
    default: ''
  },
  fulfilledAt: {
    type: Date,
    default: null
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['issued', 'pending_manual', 'no_winner', 'no_reward_configured'],
    required: true
  },
  settledAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model(
  'VirtualRunRewardSettlement',
  virtualRunRewardSettlementSchema
);
