const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['earn', 'redeem', 'earned', 'redeemed'],
    required: true
  },
  coins: {
    type: Number,
    required: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Challenge'
  },
  virtualRunEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  description: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

coinTransactionSchema.index(
  { virtualRunEventId: 1 },
  { unique: true, partialFilterExpression: { virtualRunEventId: { $type: 'objectId' } } }
);

coinTransactionSchema.virtual('amount').get(function () {
  return this.coins;
});

const CoinTransaction = mongoose.model('CoinTransaction', coinTransactionSchema);
module.exports = CoinTransaction;
