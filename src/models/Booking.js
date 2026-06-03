const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Links the booking to a specific user
  },
  serviceName: {
    type: String,
    required: [true, 'Please provide a service name (e.g., Yoga, Physiotherapy)']
  },
  coachName: {
    type: String,
    required: [true, 'Please provide the coach or professional name']
  },
  date: {
    type: Date,
    required: [true, 'Please provide a booking date']
  },
  time: {
    type: String,
    required: [true, 'Please provide a booking time']
  },
  mode: {
    type: String,
    enum: ['Online', 'Home Visit'],
    required: [true, 'Please select a service mode']
  },
  bookingType: {
    type: String,
    enum: ['Enquiry', 'Demo'],
    required: [true, 'Please select if this is an Enquiry or Demo']
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please provide a mobile number']
  },
  address: {
    type: String,
    default: '' // Can be empty if it's an online session
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending' // Every new booking starts as pending
  },
  price: {
    type: Number,
    required: true,
    default: 0.0
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  email: {
    type: String
  },
  gender: {
    type: String
  },
  state: {
    type: String
  },
  district: {
    type: String
  },
  area: {
    type: String
  },
  pincode: {
    type: String
  },
  startPlan: {
    type: String
  },
  availableDays: {
    type: [String],
    default: []
  },
  sourceWebsite: {
    type: String
  },
  category: {
    type: String
  },
  subcategories: {
    type: [String],
    default: []
  }
}, {
  timestamps: true // Automatically creates 'createdAt' and 'updatedAt' fields
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
