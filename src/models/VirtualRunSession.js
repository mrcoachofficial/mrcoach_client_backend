const mongoose = require('mongoose');

const virtualRunSessionSchema = new mongoose.Schema({
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
    enum: ['running', 'paused', 'completed', 'invalid'],
    default: 'running'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startedAt: {
    type: Date,
    required: true
  },
  trackingResumedAt: {
    type: Date,
    required: true,
    default: function () {
      return this.startedAt;
    }
  },
  finishedAt: {
    type: Date,
    default: null
  },
  pauseStartedAt: {
    type: Date,
    default: null
  },
  totalPausedMs: {
    type: Number,
    default: 0
  },
  totalDistanceKm: {
    type: Number,
    default: 0
  },
  lastSequence: {
    type: Number,
    default: -1
  },
  lastPoint: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date
  },
  acceptedPointCount: {
    type: Number,
    default: 0
  },
  filteredPointCount: {
    type: Number,
    default: 0
  },
  completionTimeMs: {
    type: Number,
    default: null
  },
  targetReachedAt: {
    type: Date,
    default: null
  },
  targetReachedAccuracyMeters: {
    type: Number,
    default: null
  },
  targetReachedSequence: {
    type: Number,
    default: null
  },
  targetReachedPausedMs: {
    type: Number,
    default: null
  }
}, { timestamps: true });

virtualRunSessionSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
virtualRunSessionSchema.index({ eventId: 1, status: 1, completionTimeMs: 1 });

module.exports = mongoose.model('VirtualRunSession', virtualRunSessionSchema);
