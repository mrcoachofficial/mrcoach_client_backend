const User = require('../models/User');

// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile/update
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = req.body.password;
      }
      
      // Update advanced fields
      user.whatsappUpdates = req.body.whatsappUpdates !== undefined ? req.body.whatsappUpdates : user.whatsappUpdates;
      user.gender = req.body.gender !== undefined ? req.body.gender : user.gender;
      user.age = req.body.age !== undefined ? req.body.age : user.age;
      user.dateOfBirth = req.body.dateOfBirth !== undefined ? req.body.dateOfBirth : user.dateOfBirth;
      user.area = req.body.area !== undefined ? req.body.area : user.area;
      user.pincode = req.body.pincode !== undefined ? req.body.pincode : user.pincode;
      user.district = req.body.district !== undefined ? req.body.district : user.district;
      user.state = req.body.state !== undefined ? req.body.state : user.state;
      user.serviceType = req.body.serviceType !== undefined ? req.body.serviceType : user.serviceType;
      user.preferredLanguage = req.body.preferredLanguage !== undefined ? req.body.preferredLanguage : user.preferredLanguage;
      user.alternatePhone = req.body.alternatePhone !== undefined ? req.body.alternatePhone : user.alternatePhone;
      user.address = req.body.address !== undefined ? req.body.address : user.address;
      user.emergencyContact = req.body.emergencyContact !== undefined ? req.body.emergencyContact : user.emergencyContact;
      user.fitnessGoal = req.body.fitnessGoal !== undefined ? req.body.fitnessGoal : user.fitnessGoal;

      const updatedUser = await user.save();
      
      const userObj = updatedUser.toObject();
      delete userObj.password;
      
      res.json(userObj);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload profile image
// @route   POST /api/profile/upload-image
// @access  Private
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profileImage = `/${req.file.path.replace(/\\/g, '/')}`;
    await user.save();

    res.json({
      message: 'Profile image updated successfully',
      profileImage: user.profileImage
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove profile image
// @route   DELETE /api/profile/remove-image
// @access  Private
const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profileImage = undefined;
    await user.save();

    res.json({
      message: 'Profile image removed successfully',
      profileImage: null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user location
// @route   PUT /api/profile/update-location
// @access  Private
const updateLocation = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      const { latitude, longitude, area, district, state, pincode, country } = req.body;
      
      user.location = {
        latitude: latitude !== undefined ? Number(latitude) : user.location?.latitude,
        longitude: longitude !== undefined ? Number(longitude) : user.location?.longitude,
        area: area !== undefined ? area : user.location?.area,
        district: district !== undefined ? district : user.location?.district,
        state: state !== undefined ? state : user.location?.state,
        pincode: pincode !== undefined ? pincode : user.location?.pincode,
        country: country !== undefined ? country : user.location?.country,
      };

      // Also sync top-level flat fields for compatibility
      if (area) user.area = area;
      if (pincode) user.pincode = pincode;
      if (district) user.district = district;
      if (state) user.state = state;

      const updatedUser = await user.save();
      const userObj = updatedUser.toObject();
      delete userObj.password;

      res.json(userObj);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user's notification preferences
// @route   GET /api/profile/notification-preferences
// @access  Private
const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const prefs = user.notificationPreferences || {
      bookingUpdates: true,
      sessionReminders: true,
      offersAndDeals: true
    };

    res.json(prefs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user's notification preferences
// @route   PUT /api/profile/notification-preferences
// @access  Private
const updateNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {
        bookingUpdates: true,
        sessionReminders: true,
        offersAndDeals: true
      };
    }

    const { bookingUpdates, sessionReminders, offersAndDeals } = req.body;

    if (bookingUpdates !== undefined) user.notificationPreferences.bookingUpdates = !!bookingUpdates;
    if (sessionReminders !== undefined) user.notificationPreferences.sessionReminders = !!sessionReminders;
    if (offersAndDeals !== undefined) user.notificationPreferences.offersAndDeals = !!offersAndDeals;

    await user.save();
    res.json(user.notificationPreferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user account
// @route   DELETE /api/profile/delete-account
// @access  Private
const deleteAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage,
  removeProfileImage,
  updateLocation,
  getNotificationPreferences,
  updateNotificationPreferences,
  deleteAccount
};
