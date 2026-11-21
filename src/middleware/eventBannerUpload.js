const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const uploadDirectory = path.resolve(__dirname, '../../uploads');

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const isAllowedEventBanner = file =>
  allowedMimeTypes.has(file.mimetype) &&
  allowedExtensions.has(path.extname(file.originalname).toLowerCase());

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(uploadDirectory, { recursive: true }, error => callback(error, uploadDirectory));
    },
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `event-banner-${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (isAllowedEventBanner(file)) {
      callback(null, true);
      return;
    }
    callback(new Error('Event banners must be JPG, PNG, or WebP images.'));
  }
});

const uploadEventBanner = (req, res, next) => {
  upload.single('bannerImage')(req, res, error => {
    if (error) {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        message: error.message || 'Could not upload the event banner.'
      });
    }
    if (req.file) {
      req.body = req.body || {};
      req.body.bannerImage = `/uploads/${req.file.filename}`;
    }
    next();
  });
};

module.exports = { isAllowedEventBanner, uploadEventBanner };
