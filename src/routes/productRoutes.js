const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// @desc    Get all products (public)
// @route   GET /api/products
router.get('/', async (req, res) => {
  try {
    let products = await Product.find({});
    // Seed default products if database is empty
    if (products.length === 0) {
      const defaults = [
        { title: 'PREMIUM YOGA MAT', price: 999, status: 'In Stock', deliveryTime: 'Free Delivery', location: 'Ships from Chennai' },
        { title: 'HERBAL PROTEIN POWDER', price: 1499, status: 'Limited', deliveryTime: 'Same Day', location: 'Ships from Chennai' },
        { title: 'PROTEIN SUPPLEMENT PACK', price: 1999, status: 'In Stock', deliveryTime: 'Next Day', location: 'Ships from Chennai' },
        { title: 'GYM EQUIPMENT PACK', price: 4999, status: 'In Stock', deliveryTime: 'Next Day', location: 'Ships from Chennai' }
      ];
      products = await Product.create(defaults);
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
