const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy0xqytwu',
  api_key: process.env.CLOUDINARY_API_KEY || '521597577437679',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'e_1F7BidvFmTOb99keKYkcYkgCA'
});

// Use memory storage for Multer
const storage = multer.memoryStorage();

function checkFileType(file, cb) {
  const filetypes = /jpg|jpeg|png|webp/;
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only!'));
  }
}

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  // Upload stream to Cloudinary
  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: 'mrcoach' },
    (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return res.status(500).send({ message: 'Cloudinary upload failed', error });
      }
      res.send({
        message: 'Image Uploaded',
        imageUrl: result.secure_url,
      });
    }
  );

  uploadStream.end(req.file.buffer);
});

module.exports = router;

