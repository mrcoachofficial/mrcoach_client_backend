const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  sendPasswordOtp,
  verifyPasswordOtp,
  changePassword,
  sendOtp,
  verifyOtp,
  googleLogin
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google', googleLogin);
router.get('/profile', protect, getUserProfile);

router.post('/send-password-otp', protect, sendPasswordOtp);
router.post('/verify-password-otp', protect, verifyPasswordOtp);
router.post('/change-password', protect, changePassword);

module.exports = router;
