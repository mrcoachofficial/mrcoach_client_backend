const mongoose = require('mongoose');

const eventParticipantSchema = new mongoose.Schema({
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
  distance: {
    type: Number,
    min: 0,
    default: 0
  },
  time: {
    type: Number,
    min: 0,
    default: null
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { _id: false });

const eventOrganizerSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: ''
  },
  logo: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Please add an event title']
  },
  description: {
    type: String,
    default: ''
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  image: {
    type: String,
    default: ''
  },
  bannerImage: {
    type: String,
    trim: true,
    default: ''
  },
  sport: {
    type: String,
    trim: true,
    default: ''
  },
  format: {
    type: String,
    trim: true,
    default: ''
  },
  startDateTime: {
    type: Date
  },
  recurrence: {
    type: String,
    trim: true,
    default: ''
  },
  locationName: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  lat: {
    type: Number,
    min: -90,
    max: 90
  },
  lng: {
    type: Number,
    min: -180,
    max: 180
  },
  organizer: {
    type: eventOrganizerSchema,
    default: () => ({})
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please add an end date']
  },
  location: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  category: {
    type: String,
    required: true,
    default: 'Fitness'
  },
  websiteUrl: {
    type: String,
    default: ''
  },
  eventType: {
    type: String,
    enum: ['inPerson', 'virtualRun', 'activityChallenge'],
    default: 'inPerson'
  },
  allowedActivityTypes: {
    type: [{
      type: String,
      enum: ['walking', 'running', 'cycling']
    }],
    default: undefined
  },
  minDurationMinutes: {
    type: Number,
    min: 1
  },
  minDistanceKm: {
    type: Number,
    min: 0.01
  },
  progressMetric: {
    type: String,
    enum: ['days', 'sessions']
  },
  requiredActivityCount: {
    type: Number,
    min: 1
  },
  rewardCoins: {
    type: Number,
    min: 0,
    default: 0
  },
  badgeName: {
    type: String,
    trim: true,
    default: ''
  },
  targetDistanceKm: {
    type: Number,
    min: 0.1,
    default: 5
  },
  targetDistance: {
    type: Number,
    min: 0.1
  },
  maxParticipants: {
    type: Number,
    min: 1
  },
  rules: {
    type: String,
    default: ''
  },
  rewards: {
    type: String,
    default: ''
  },
  participationRules: {
    type: String,
    default: ''
  },
  winnerRewards: {
    type: String,
    default: ''
  },
  winnerRewardType: {
    type: String,
    enum: ['voucher', 'discount', 'coins', 'manual'],
    default: 'manual'
  },
  winnerRewardValue: {
    type: Number,
    min: 0,
    default: 0
  },
  publicationStatus: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  resultsFinalizedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  participants: {
    type: [eventParticipantSchema],
    default: []
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Dynamic virtual field to calculate if completed based on current time
eventSchema.virtual('isCompleted').get(function() {
  return new Date() > this.endDate;
});

// Map _id to id for client convenience
eventSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

eventSchema.index({ status: 1, startDate: 1 });
eventSchema.index({ 'participants.userId': 1 });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
