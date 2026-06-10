const User = require('../models/User');
const Referral = require('../models/Referral');
const FraudAttempt = require('../models/FraudAttempt');
const jwt = require('jsonwebtoken');

const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const sendSms = require('../utils/sendSms');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, referralCode, deviceId, signupMetadata } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let referredBy = undefined;
    let referrer = null;

    if (referralCode) {
      referrer = await User.findOne({ referralCode: referralCode.trim() });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code' });
      }

      if (referrer.email === email) {
        await FraudAttempt.create({
          email,
          deviceId,
          ipAddress,
          type: 'SELF_REFERRAL',
          details: 'User tried to refer themselves.'
        });
        return res.status(400).json({ message: 'Self-referral is not allowed' });
      }

      if (deviceId) {
        const deviceExists = await User.findOne({ deviceId });
        if (deviceExists) {
          await FraudAttempt.create({
            email,
            deviceId,
            ipAddress,
            type: 'SAME_DEVICE_REFERRAL',
            details: `Device already registered under user ${deviceExists.email}`
          });
          return res.status(400).json({ message: 'Registration blocked: device already registered' });
        }
      }

      referredBy = referrer._id;
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      role: role || 'user',
      referredBy,
      deviceId,
      signupIp: ipAddress,
      signupMetadata
    });

    await user.save();

    if (user) {
      // If referred, create the Referral record and update stats
      if (referredBy && referrer) {
        await Referral.create({
          referrer: referredBy,
          referredUser: user._id,
          referralCode: referralCode.trim(),
          status: 'SIGNED_UP'
        });

        referrer.referralStats.totalInvites += 1;
        referrer.referralStats.totalJoined += 1;
        await referrer.save();
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        referralCode: user.referralCode,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body; // 'email' can be email or phone number from the client

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email/phone number and password' });
    }

    const cleanIdentifier = email.trim();

    // Query both email and phoneNumber (with and without +91 prefix)
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier.toLowerCase() },
        { phoneNumber: cleanIdentifier },
        { phoneNumber: cleanIdentifier.startsWith('+91') ? cleanIdentifier : `+91${cleanIdentifier}` }
      ]
    });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials. Please check your inputs.' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
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

// @desc    Send password reset OTP
// @route   POST /api/auth/send-password-otp
// @access  Private
const sendPasswordOtp = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Step 3: Validate current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // Rate limit check: 1 minute cooldown
    if (user.passwordResetOtpLastSent) {
      const timeDiff = Date.now() - new Date(user.passwordResetOtpLastSent).getTime();
      if (timeDiff < 60 * 1000) {
        const secondsLeft = Math.ceil((60 * 1000 - timeDiff) / 1000);
        return res.status(429).json({ message: `Please wait ${secondsLeft} seconds before requesting a new OTP` });
      }
    }

    // Step 4: Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Save hashed OTP and expiry
    user.passwordResetOtp = hashedOtp;
    user.passwordResetOtpExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    user.passwordResetOtpLastSent = Date.now();
    user.passwordResetOtpAttempts = 0;

    await user.save();

    // Step 5: Send OTP using nodemailer
    const subject = 'MrCoach Password Reset OTP';
    const text = `Your OTP for password reset is:\n${otp}\n\nThis OTP expires in 5 minutes.\n\nIf you did not request this change, please ignore this email.`;

    const emailResult = await sendEmail({ to: user.email, subject, text });

    res.json({
      message: 'OTP sent to registered email successfully',
      mockUsed: emailResult.mock || false
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify password reset OTP
// @route   POST /api/auth/verify-password-otp
// @access  Private
const verifyPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: 'OTP is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.passwordResetOtp || !user.passwordResetOtpExpires) {
      return res.status(400).json({ message: 'No OTP requested or OTP has been cleared' });
    }

    if (new Date(user.passwordResetOtpExpires).getTime() < Date.now()) {
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (user.passwordResetOtpAttempts >= 5) {
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP' });
    }

    const isMatch = await bcrypt.compare(otp, user.passwordResetOtp);
    if (!isMatch) {
      user.passwordResetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change password after verification
// @route   POST /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword) {
      return res.status(400).json({ message: 'OTP and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.passwordResetOtp || !user.passwordResetOtpExpires) {
      return res.status(400).json({ message: 'No OTP requested or OTP has been cleared' });
    }

    if (new Date(user.passwordResetOtpExpires).getTime() < Date.now()) {
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired' });
    }

    if (user.passwordResetOtpAttempts >= 5) {
      user.passwordResetOtp = undefined;
      user.passwordResetOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP' });
    }

    const isMatch = await bcrypt.compare(otp, user.passwordResetOtp);
    if (!isMatch) {
      user.passwordResetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP code' });
    }

    // Update password
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetOtpExpires = undefined;
    user.passwordResetOtpAttempts = 0;

    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send OTP to user's phone number
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
  try {
    const { phoneNumber, isLogin } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Please provide a phone number' });
    }

    const cleanPhone = phoneNumber.trim();

    // Find or create user
    let user = await User.findOne({ phoneNumber: cleanPhone });
    if (!user) {
      if (isLogin === true) {
        return res.status(404).json({ message: 'This mobile number is not registered. Please sign up first!' });
      }
      user = new User({
        phoneNumber: cleanPhone,
        authProvider: 'phone_otp',
        phoneVerified: false
      });
      await user.save();
    }

    // Rate limiting spam check (60s)
    if (user.phoneOtpLastSent && (Date.now() - new Date(user.phoneOtpLastSent).getTime() < 60000)) {
      return res.status(429).json({ message: 'Please wait 60 seconds before requesting another OTP' });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Call SMS utility (sends via MSG91 if configured, else prints to console)
    await sendSms(cleanPhone, otp);

    user.phoneOtp = otp;
    user.phoneOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiration
    user.phoneOtpLastSent = new Date();
    user.phoneOtpAttempts = 0;

    await user.save();

    const responsePayload = { message: 'OTP sent successfully' };
    if (process.env.NODE_ENV !== 'production') {
      responsePayload.dummyOtp = otp;
    }
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP and log in / register
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp, whatsappUpdates } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ message: 'Please provide phone number and OTP' });
    }

    const cleanPhone = phoneNumber.trim();
    const user = await User.findOne({ phoneNumber: cleanPhone });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check expiration
    if (!user.phoneOtp || !user.phoneOtpExpires) {
      return res.status(400).json({ message: 'No OTP requested' });
    }

    if (new Date(user.phoneOtpExpires).getTime() < Date.now()) {
      user.phoneOtp = undefined;
      user.phoneOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Retry limit check
    if (user.phoneOtpAttempts >= 3) {
      user.phoneOtp = undefined;
      user.phoneOtpExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new OTP' });
    }

    // Compare OTP
    if (user.phoneOtp !== otp.trim()) {
      user.phoneOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Success
    user.phoneVerified = true;
    user.phoneOtp = undefined;
    user.phoneOtpExpires = undefined;
    user.phoneOtpAttempts = 0;
    user.lastLoginAt = new Date();
    if (whatsappUpdates !== undefined) {
      user.whatsappUpdates = !!whatsappUpdates;
    }

    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login/Register with Google ID Token
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    if (!idToken && !accessToken) {
      return res.status(400).json({ message: 'Please provide Google ID Token or Access Token' });
    }

    let payload;
    if (idToken) {
      // Verify ID token with Google's API
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (!response.ok) {
        return res.status(400).json({ message: 'Invalid Google ID Token' });
      }
      payload = await response.json();
    } else {
      // Verify Access token with Google's Userinfo API
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
      if (!response.ok) {
        return res.status(400).json({ message: 'Invalid Google Access Token' });
      }
      payload = await response.json();
    }
    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Email address not shared by Google' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: name || 'Google User',
        email: email,
        authProvider: 'google',
        phoneVerified: false,
        profileImage: picture
      });
      await user.save();
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  sendPasswordOtp,
  verifyPasswordOtp,
  changePassword,
  sendOtp,
  verifyOtp,
  googleLogin
};
