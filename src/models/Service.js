const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a service title (e.g., "Advanced Yoga")']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Fitness', 'Physio', 'Sports', 'Yoga', 'Therapy', 'Nutrition', 'Other', 'CategoryBanner', 'CategoryInnerBanner']
  },
  price: {
    type: Number,
    required: true,
    default: 0
  },
  durationMinutes: {
    type: Number,
    required: true,
    default: 60
  },
  imageUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Service = mongoose.model('Service', serviceSchema);
module.exports = Service;
