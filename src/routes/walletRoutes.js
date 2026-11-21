const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');
const { redeemCoinsForVoucher } = require('../controllers/rewardController');

router.get('/balance', protect, walletController.getWalletBalance);
router.post('/add-coins', protect, walletController.addCoinsForTrip);
router.post('/redeem', protect, redeemCoinsForVoucher);

module.exports = router;
