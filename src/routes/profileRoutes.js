const path = require('path');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  uploadProfileImage,
  removeProfileImage,
  updateLocation,
  getNotificationPreferences,
  updateNotificationPreferences,
  deleteAccount
} = require('../controllers/profileController');

// Multer storage setup for profile images
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `profile-${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only (jpg, jpeg, png, webp)!'));
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

// Protect all routes below
router.use(protect);

router.get('/', getProfile);
router.put('/update', updateProfile);
router.put('/update-location', updateLocation);
router.post('/upload-image', upload.single('image'), uploadProfileImage);
router.delete('/remove-image', removeProfileImage);
router.get('/notification-preferences', getNotificationPreferences);
router.put('/notification-preferences', updateNotificationPreferences);
router.delete('/delete-account', deleteAccount);

module.exports = router;
