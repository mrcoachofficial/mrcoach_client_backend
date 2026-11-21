const express = require('express');
const router = express.Router();
const Coach = require('../models/Coach');

// @desc    Get all coaches (public)
// @route   GET /api/coaches
router.get('/', async (req, res) => {
  try {
    let coaches = await Coach.find({});
    // Seed default coaches if database is empty
    if (coaches.length === 0) {
      const defaults = [
        { name: 'Arun Kumar', category: 'Strength Coach', sessionsCompleted: '250+ Sessions', rating: 4.9, imageUrl: '' },
        { name: 'Divya R.', category: 'Yoga Expert', sessionsCompleted: '180+ Sessions', rating: 4.9, imageUrl: '' },
        { name: 'Vikram S.', category: 'Physiotherapist', sessionsCompleted: '300+ Sessions', rating: 4.8, imageUrl: '' },
        { name: 'Megha S.', category: 'Nutritionist', sessionsCompleted: '220+ Sessions', rating: 4.8, imageUrl: '' }
      ];
      coaches = await Coach.create(defaults);
    }
    res.json(coaches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
