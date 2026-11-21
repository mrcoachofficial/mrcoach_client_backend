const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sourceEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  voucherCode: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  coinsUsed: {
    type: Number,
    required: true
  },
  isPercentage: {
    type: Boolean,
    default: false
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'used', 'expired'],
    default: 'active'
  }
}, {
  timestamps: true
});

voucherSchema.index(
  { sourceEventId: 1 },
  { unique: true, partialFilterExpression: { sourceEventId: { $type: 'objectId' } } }
);

const Voucher = mongoose.model('Voucher', voucherSchema);
module.exports = Voucher;
