const mongoose = require('mongoose');

const coachSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a coach name']
  },
  category: {
    type: String,
    required: [true, 'Please add a specialty/category (e.g. Strength Coach)']
  },
  sessionsCompleted: {
    type: String,
    required: [true, 'Please add sessions completed count (e.g. 250+ Sessions)']
  },
  rating: {
    type: Number,
    required: true,
    default: 5.0
  },
  imageUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Coach = mongoose.model('Coach', coachSchema);
module.exports = Coach;
