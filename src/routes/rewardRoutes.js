const express = require('express');
const router = express.Router();
const {
  getUserRewards,
  updateRewardStatus,
  getRewardsStatus,
  createCampaign,
  getCampaigns,
  toggleCampaignStatus,
  deleteCampaign,
  getUserWallet,
  getCoinTransactions,
  getChallenges,
  updateChallengeProgress,
  claimChallengeReward,
  redeemCoinsForVoucher,
  getUserVouchers,
  applyVoucher,
  useVoucher,
  adminCreateChallenge,
  adminGetChallenges,
  adminUpdateChallenge,
  adminDeleteChallenge
} = require('../controllers/rewardController');

const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getUserRewards);

router.route('/status')
  .get(getRewardsStatus);

router.route('/wallet')
  .get(protect, getUserWallet);

router.route('/transactions')
  .get(protect, getCoinTransactions);

router.route('/challenges')
  .get(protect, getChallenges);

router.route('/challenges/:id/progress')
  .post(protect, updateChallengeProgress);

router.route('/challenges/:id/claim')
  .post(protect, claimChallengeReward);

router.route('/vouchers')
  .get(protect, getUserVouchers);

router.route('/vouchers/redeem')
  .post(protect, redeemCoinsForVoucher);

router.route('/vouchers/apply')
  .post(protect, applyVoucher);

router.route('/vouchers/use')
  .post(protect, useVoucher);

router.route('/:id')
  .put(protect, updateRewardStatus);

// Admin-only endpoints
router.route('/admin/campaigns')
  .post(protect, admin, createCampaign)
  .get(protect, admin, getCampaigns);

router.route('/admin/campaigns/:id')
  .delete(protect, admin, deleteCampaign);

router.route('/admin/campaigns/:id/status')
  .put(protect, admin, toggleCampaignStatus);

router.route('/admin/challenges')
  .post(protect, admin, adminCreateChallenge)
  .get(protect, admin, adminGetChallenges);

router.route('/admin/challenges/:id')
  .put(protect, admin, adminUpdateChallenge)
  .delete(protect, admin, adminDeleteChallenge);

module.exports = router;

