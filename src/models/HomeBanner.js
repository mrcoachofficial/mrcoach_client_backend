const mongoose = require('mongoose');

const homeBannerSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  ctaText: {
    type: String,
    default: ''
  },
  redirectType: {
    type: String,
    enum: ['service', 'event', 'rewards', 'web', 'booking', 'product', 'none'],
    default: 'none'
  },
  redirectId: {
    type: String,
    default: ''
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  redirectionUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const HomeBanner = mongoose.model('HomeBanner', homeBannerSchema);
module.exports = HomeBanner;
