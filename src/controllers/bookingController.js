const Booking = require('../models/Booking');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private (Only logged in users can book)
const createBooking = async (req, res) => {
  try {
    // Only clients (users) should be able to book, not coaches!
    if (req.user.role === 'coach') {
      return res.status(403).json({ message: 'Access denied: Coaches cannot make client bookings.' });
    }

    // Check if maintenance mode is enabled
    const Config = require('../models/Config');
    const maintenance = await Config.findOne({ key: 'maintenanceMode' });
    if (maintenance && maintenance.value === true) {
      return res.status(503).json({ message: 'The booking portal is temporarily closed for maintenance. Please try again later.' });
    }

    const { 
      serviceName, 
      coachName, 
      date, 
      time, 
      price, 
      mode, 
      bookingType, 
      mobileNumber, 
      address,
      paymentStatus,
      razorpayOrderId,
      razorpayPaymentId,
      name,
      email,
      gender,
      state,
      district,
      area,
      pincode,
      startPlan,
      availableDays,
      sourceWebsite,
      category,
      subcategories
    } = req.body;

    // Update slot capacity if booking is a demo session
    if (bookingType && bookingType.toLowerCase() === 'demo' && date && time) {
      const Slot = require('../models/Slot');
      const slot = await Slot.findOne({ date, time });
      if (slot) {
        if (!slot.isAvailable || slot.capacity <= 0) {
          return res.status(400).json({ message: 'Selected time slot is no longer available.' });
        }
        slot.capacity -= 1;
        if (slot.capacity <= 0) {
          slot.isAvailable = false;
        }
        await slot.save();
      }
    }

    // Set initial status to 'confirmed' if this is a paid booking, otherwise 'pending'
    const isPaid = paymentStatus === 'paid' || (price > 0 && razorpayPaymentId);
    const initialStatus = isPaid ? 'confirmed' : 'pending';

    const booking = new Booking({
      user: req.user._id, // Got this from the protect middleware!
      serviceName,
      coachName,
      date,
      time,
      price,
      mode,
      bookingType,
      mobileNumber,
      address,
      paymentStatus: isPaid ? 'paid' : 'unpaid',
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      status: initialStatus,
      email,
      gender,
      state,
      district,
      area,
      pincode,
      startPlan,
      availableDays,
      sourceWebsite,
      category,
      subcategories
    });

    const createdBooking = await booking.save();

    // Update user profile fields with the onboarding questionnaire details
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      name: name || req.user.name,
      email: email || req.user.email,
      gender: gender || req.user.gender,
      state: state || req.user.state,
      district: district || req.user.district,
      area: area || req.user.area,
      pincode: pincode || req.user.pincode,
      serviceType: mode || req.user.serviceType,
      startPlan: startPlan || req.user.startPlan,
      availableDays: availableDays || req.user.availableDays,
      sourceWebsite: sourceWebsite || req.user.sourceWebsite,
      category: category || req.user.category,
      subcategories: subcategories || req.user.subcategories
    });

    // Auto-award a scratch card reward to the user (if rewards are enabled)
    const { autoAwardReward } = require('./rewardController');
    const reward = await autoAwardReward(req.user._id, `${serviceName} Booking`);

    res.status(201).json({
      ...createdBooking.toObject(),
      reward: reward ? {
        _id: reward._id,
        rewardAmount: reward.rewardAmount,
        title: reward.title,
        subTitle: reward.subTitle,
        condition: reward.condition,
        earnedFrom: reward.earnedFrom,
        expiryDate: reward.expiryDate,
        status: reward.status,
        theme: reward.theme
      } : null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get logged in user's bookings
// @route   GET /api/bookings/mybookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    // Find all bookings where the user ID matches the logged-in user
    const bookings = await Booking.find({ user: req.user._id }).sort({ date: 1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all bookings (For Admin dashboard)
// @route   GET /api/bookings
// @access  Private
const getBookings = async (req, res) => {
  try {
    // populate('user') will bring in the user's name and email along with the booking
    const bookings = await Booking.find({}).populate('user', 'id name email');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update booking status (e.g. from pending to confirmed)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (booking) {
      booking.status = status;
      const updatedBooking = await booking.save();

      // Trigger Referral & Reward Engine
      if (status === 'confirmed' || status === 'completed') {
        const { processBookingReward } = require('../services/referralService');
        await processBookingReward(booking._id);
      }

      res.json(updatedBooking);
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookings,
  updateBookingStatus
};
