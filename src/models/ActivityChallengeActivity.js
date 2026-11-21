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
  clientActivityId: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  activityType: {
    type: String,
    enum: ['walking', 'running', 'cycling'],
    required: true
  },
  activityDate: {
    type: Date,
    required: true
  },
  activityDayKey: {
    type: Date,
    default: undefined
  },
  startedAt: {
    type: Date,
    required: true
  },
  finishedAt: {
    type: Date,
    required: true
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 0
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  gpsPointCount: {
    type: Number,
    required: true,
    min: 2
  },
  status: {
    type: String,
    enum: ['approved', 'pending_review', 'rejected'],
    required: true
  },
  reviewReason: {
    type: String,
    default: ''
  }
}, { timestamps: true });

schema.index({ eventId: 1, userId: 1, clientActivityId: 1 }, { unique: true });
schema.index(
  { eventId: 1, userId: 1, activityDayKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activityDayKey: { $type: 'date' } }
  }
);
schema.index({ eventId: 1, userId: 1, status: 1, activityDate: 1 });

module.exports = mongoose.model('ActivityChallengeActivity', schema);
