const UserWallet = require('../models/UserWallet');
const CoinTransaction = require('../models/CoinTransaction');
const rewardController = require('./rewardController');

exports.getWalletBalance = async (req, res) => {
  try {
    const wallet = await UserWallet.findOneAndUpdate(
      { userId: req.user._id },
      { $setOnInsert: { currentCoins: 0, lifetimeCoins: 0, redeemedCoins: 0 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const transactions = await CoinTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      currentCoins: wallet.currentCoins,
      lifetimeCoins: wallet.lifetimeCoins,
      redeemedCoins: wallet.redeemedCoins,
      transactions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addCoinsForTrip = async (req, res) => {
  const tripId = req.body.trip_id || req.body.tripId || req.body.challenge_id;
  if (!tripId) {
    return res.status(400).json({ message: 'A challenge trip_id is required' });
  }

  req.params.id = tripId;
  return rewardController.claimChallengeReward(req, res);
};
