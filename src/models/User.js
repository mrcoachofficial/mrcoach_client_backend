const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Coach Client'
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String
  },
  phoneNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  authProvider: {
    type: String,
    enum: ['phone_otp', 'google', 'email', 'apple'],
    default: 'email'
  },
  appleUserId: {
    type: String,
    unique: true,
    sparse: true
  },
  lastLoginAt: {
    type: Date
  },
  guestMode: {
    type: Boolean,
    default: false
  },
  otpVerificationStatus: {
    type: String
  },
  phoneOtp: {
    type: String
  },
  phoneOtpExpires: {
    type: Date
  },
  phoneOtpAttempts: {
    type: Number,
    default: 0
  },
  phoneOtpLastSent: {
    type: Date
  },
  role: {
    type: String,
    enum: ['user', 'coach', 'admin'],
    default: 'user'
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  age: {
    type: Number
  },
  dateOfBirth: {
    type: String
  },
  area: {
    type: String
  },
  pincode: {
    type: String
  },
  district: {
    type: String
  },
  state: {
    type: String
  },
  serviceType: {
    type: String,
    enum: ['Online', 'Home Visit', 'Hybrid']
  },
  preferredLanguage: {
    type: String,
    default: 'English'
  },
  alternatePhone: {
    type: String
  },
  address: {
    type: String
  },
  startPlan: {
    type: String
  },
  availableDays: {
    type: [String],
    default: []
  },
  sourceWebsite: {
    type: String
  },
  category: {
    type: String
  },
  subcategories: {
    type: [String],
    default: []
  },
  profileImage: {
    type: String
  },
  emergencyContact: {
    type: String
  },
  fitnessGoal: {
    type: String
  },
  location: {
    latitude: Number,
    longitude: Number,
    area: String,
    district: String,
    state: String,
    pincode: String,
    country: String
  },
  notificationPreferences: {
    bookingUpdates: {
      type: Boolean,
      default: true
    },
    sessionReminders: {
      type: Boolean,
      default: true
    },
    offersAndDeals: {
      type: Boolean,
      default: true
    }
  },
  whatsappUpdates: {
    type: Boolean,
    default: true
  },
  passwordResetOtp: {
    type: String
  },
  passwordResetOtpExpires: {
    type: Date
  },
  passwordResetOtpLastSent: {
    type: Date
  },
    passwordResetOtpAttempts: {
      type: Number,
      default: 0
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    referralStats: {
      totalInvites: { type: Number, default: 0 },
      totalJoined: { type: Number, default: 0 },
      totalEarned: { type: Number, default: 0 },
      pendingRewards: { type: Number, default: 0 }
    },
    deviceId: {
      type: String
    },
    signupIp: {
      type: String
    },
    signupMetadata: {
      type: mongoose.Schema.Types.Mixed
    },
    deleted: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });

  // Pre-save middleware to hash password and generate referral code before saving
  userSchema.pre('save', async function () {
    // Generate referral code if not exists
    if (!this.referralCode) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let isUnique = false;
      let code = '';
      
      // Keep generating until unique
      while (!isUnique) {
        let rand = '';
        for (let i = 0; i < 4; i++) {
          rand += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const year = new Date().getFullYear();
        code = `MRCOACH${year}${rand}`;
        
        // Check database if code exists
        const existing = await mongoose.models.User.findOne({ referralCode: code });
        if (!existing) {
          isUnique = true;
        }
      }
      this.referralCode = code;
    }

    if (!this.isModified('password') || !this.password) {
      return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  });

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
