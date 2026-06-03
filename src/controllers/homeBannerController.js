const HomeBanner = require('../models/HomeBanner');

// @desc    Get active home banners for client app
// @route   GET /api/home-banners/active
// @access  Public
const getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await HomeBanner.find({
      isActive: true,
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: null },
        { endDate: { $gt: now } }
      ]
    }).sort({ displayOrder: 1, createdAt: -1 });

    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin: Get all home banners
// @route   GET /api/home-banners/admin
// @access  Private/Admin
const adminGetBanners = async (req, res) => {
  try {
    const banners = await HomeBanner.find({}).sort({ displayOrder: 1, createdAt: -1 });
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin: Create new home banner
// @route   POST /api/home-banners/admin
// @access  Private/Admin
const createBanner = async (req, res) => {
  try {
    const {
      imageUrl,
      title,
      subtitle,
      ctaText,
      redirectType,
      redirectId,
      displayOrder,
      isActive,
      startDate,
      endDate,
      redirectionUrl
    } = req.body;

    const banner = await HomeBanner.create({
      imageUrl,
      title,
      subtitle,
      ctaText,
      redirectType,
      redirectId,
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate || Date.now(),
      endDate: endDate || null,
      redirectionUrl: redirectionUrl || ''
    });

    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin: Update home banner
// @route   PUT /api/home-banners/admin/:id
// @access  Private/Admin
const updateBanner = async (req, res) => {
  try {
    const {
      imageUrl,
      title,
      subtitle,
      ctaText,
      redirectType,
      redirectId,
      displayOrder,
      isActive,
      startDate,
      endDate,
      redirectionUrl
    } = req.body;

    const banner = await HomeBanner.findById(req.params.id);

    if (banner) {
      banner.imageUrl = imageUrl !== undefined ? imageUrl : banner.imageUrl;
      banner.title = title !== undefined ? title : banner.title;
      banner.subtitle = subtitle !== undefined ? subtitle : banner.subtitle;
      banner.ctaText = ctaText !== undefined ? ctaText : banner.ctaText;
      banner.redirectType = redirectType !== undefined ? redirectType : banner.redirectType;
      banner.redirectId = redirectId !== undefined ? redirectId : banner.redirectId;
      banner.displayOrder = displayOrder !== undefined ? displayOrder : banner.displayOrder;
      banner.isActive = isActive !== undefined ? isActive : banner.isActive;
      banner.startDate = startDate !== undefined ? startDate : banner.startDate;
      banner.endDate = endDate !== undefined ? endDate : banner.endDate;
      banner.redirectionUrl = redirectionUrl !== undefined ? redirectionUrl : banner.redirectionUrl;

      const updatedBanner = await banner.save();
      res.json(updatedBanner);
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin: Delete home banner
// @route   DELETE /api/home-banners/admin/:id
// @access  Private/Admin
const deleteBanner = async (req, res) => {
  try {
    const banner = await HomeBanner.findById(req.params.id);

    if (banner) {
      await banner.deleteOne();
      res.json({ message: 'Banner deleted successfully' });
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin: Toggle banner active status
// @route   PUT /api/home-banners/admin/:id/toggle
// @access  Private/Admin
const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await HomeBanner.findById(req.params.id);

    if (banner) {
      banner.isActive = !banner.isActive;
      await banner.save();
      res.json(banner);
    } else {
      res.status(404).json({ message: 'Banner not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getActiveBanners,
  adminGetBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus
};
