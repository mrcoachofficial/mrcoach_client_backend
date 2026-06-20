const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const Slot = require('../models/Slot');
const Product = require('../models/Product');
const Config = require('../models/Config');
const EventBooking = require('../models/EventBooking');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '30d',
  });
};

// @desc    Admin Login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`Admin login attempt for: ${email}`);

    // Check if user exists
    let user = await User.findOne({ email });
    console.log(`User found in DB: ${user ? 'Yes (role: ' + user.role + ')' : 'No'}`);

    // For first-time setup: Create default admin if no admin exists
    if (email === 'admin@mrcoach.in' && !user) {
      console.log('Seeding default admin user...');
      user = await User.create({
        name: 'Super Admin',
        email: 'admin@mrcoach.in',
        password: password, // Will be hashed by pre-save
        role: 'admin'
      });
      console.log('Default admin seeded successfully.');
    }

    if (user) {
      const isMatch = await user.matchPassword(password);
      console.log(`Password matches: ${isMatch}`);
      
      if (isMatch) {
        if (user.role !== 'admin') {
          console.log(`Login blocked: user role is ${user.role}, not admin`);
          return res.status(403).json({ message: 'Access Denied: Not an Administrator' });
        }

        console.log('Login successful! Sending token...');
        res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id)
        });
      } else {
        console.log('Password does not match.');
        res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      console.log('No user found and not seeding.');
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error in adminLogin:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all bookings for Admin Dashboard
// @route   GET /api/admin/bookings
// @access  Public (Temporary for dev)
const getAdminBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({}).populate('user', 'name email');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update service (e.g. image) for Admin Dashboard
// @route   PUT /api/admin/services/:id
// @access  Public (Temporary for dev)
const updateAdminService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (service) {
      service.title = req.body.title || service.title;
      service.price = req.body.price !== undefined ? req.body.price : service.price;
      service.imageUrl = req.body.imageUrl || service.imageUrl;
      service.description = req.body.description || service.description;
      service.category = req.body.category || service.category;

      const updatedService = await service.save();
      res.json(updatedService);
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete service for Admin Dashboard
// @route   DELETE /api/admin/services/:id
// @access  Public (Temporary for dev)
const deleteAdminService = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (service) {
      await Service.deleteOne({ _id: service._id });
      res.json({ message: 'Service removed' });
    } else {
      res.status(404).json({ message: 'Service not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all slots
// @route   GET /api/admin/slots
// @access  Public (Temporary for dev)
const getAdminSlots = async (req, res) => {
  try {
    const parseTimeToMinutes = (timeStr) => {
      const match = timeStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours !== 12) hours += 12;
      else if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    let slots = await Slot.find({});
    // Seed default slots for the next 7 days if database is empty
    if (slots.length === 0) {
      const defaults = [];
      const times = ['06:00 AM', '08:00 AM', '10:00 AM', '04:00 PM', '06:00 PM'];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0]; // "YYYY-MM-DD"
        times.forEach(t => {
          defaults.push({
            date: dateStr,
            time: t,
            isAvailable: true,
            capacity: 2,
            serviceName: 'General'
          });
        });
      }
      slots = await Slot.create(defaults);
    }

    // Fetch actual bookings to count live bookings per slot
    const Booking = require('../models/Booking');
    const bookings = await Booking.find({}).populate('user', 'name email mobileNumber');

    const slotsWithBookings = slots.map(slot => {
      const slotDateStr = slot.date;
      const slotTimeStr = slot.time;

      const matchingBookings = bookings.filter(b => {
        const bookingDateStr = b.date ? new Date(b.date).toISOString().split('T')[0] : '';
        return bookingDateStr === slotDateStr && b.time === slotTimeStr;
      });

      return {
        ...slot.toObject(),
        bookings: matchingBookings.map(b => ({
          _id: b._id,
          userName: b.user?.name || 'Guest User',
          userEmail: b.user?.email || 'N/A',
          mobileNumber: b.mobileNumber || 'N/A',
          serviceName: b.serviceName,
          status: b.status,
          bookingType: b.bookingType
        }))
      };
    });

    // Sort chronologically (by date, then by time in minutes)
    slotsWithBookings.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
    });

    res.json(slotsWithBookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new slot
// @route   POST /api/admin/slots
// @access  Public (Temporary for dev)
const createAdminSlot = async (req, res) => {
  try {
    const { date, time, capacity, serviceName } = req.body;
    const slot = await Slot.create({ date, time, capacity, serviceName });
    res.status(201).json(slot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a slot
// @route   DELETE /api/admin/slots/:id
// @access  Public (Temporary for dev)
const deleteAdminSlot = async (req, res) => {
  try {
    const slot = await Slot.findByIdAndDelete(req.params.id);
    if (slot) {
      res.json({ message: 'Slot removed' });
    } else {
      res.status(404).json({ message: 'Slot not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all products
// @route   GET /api/admin/products
// @access  Public (Temporary for dev)
const getAdminProducts = async (req, res) => {
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
};

// @desc    Create product
// @route   POST /api/admin/products
// @access  Public (Temporary for dev)
const createAdminProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:id
// @access  Public (Temporary for dev)
const updateAdminProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/admin/products/:id
// @access  Public (Temporary for dev)
const deleteAdminProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product) {
      res.json({ message: 'Product removed' });
    } else {
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change admin password
// @route   PUT /api/admin/change-password
// @access  Private
const changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findOne({ email: 'admin@mrcoach.in' });
    if (!user) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all configurations
// @route   GET /api/admin/config
// @access  Public (Temporary for dev)
const getAdminConfigs = async (req, res) => {
  try {
    let maintenance = await Config.findOne({ key: 'maintenanceMode' });
    let notifications = await Config.findOne({ key: 'sendNotifications' });
    let rewards = await Config.findOne({ key: 'rewardsEnabled' });
    let servicesHero = await Config.findOne({ key: 'servicesHeroImage' });

    // Seed defaults if not found
    if (!maintenance) {
      maintenance = await Config.create({ key: 'maintenanceMode', value: false });
    }
    if (!notifications) {
      notifications = await Config.create({ key: 'sendNotifications', value: true });
    }
    if (!rewards) {
      rewards = await Config.create({ key: 'rewardsEnabled', value: true });
    }
    if (!servicesHero) {
      servicesHero = await Config.create({ key: 'servicesHeroImage', value: '' });
    }

    const Challenge = require('../models/Challenge');
    const challengeCount = await Challenge.countDocuments();
    if (challengeCount === 0) {
      await Challenge.create([
        { title: 'Weekly Walking Challenge', type: 'Weekly', activityType: 'Walking', target: 15, rewardCoins: 100, isActive: true },
        { title: 'Monthly Walking Challenge', type: 'Monthly', activityType: 'Walking', target: 60, rewardCoins: 500, isActive: true },
        { title: 'Monthly Power Run Challenge', type: 'Monthly', activityType: 'Running', target: 40, rewardCoins: 800, isActive: true },
        { title: 'Monthly Cycling Challenge', type: 'Monthly', activityType: 'Cycling', target: 100, rewardCoins: 1000, isActive: true }
      ]);
      console.log('Default Challenges seeded successfully.');
    }

    res.json({
      maintenanceMode: maintenance.value,
      sendNotifications: notifications.value,
      rewardsEnabled: rewards.value,
      servicesHeroImage: servicesHero.value
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update system configuration
// @route   PUT /api/admin/config
// @access  Public (Temporary for dev)
const updateAdminConfig = async (req, res) => {
  try {
    const { key, value } = req.body;
    let config = await Config.findOne({ key });
    if (config) {
      config.value = value;
      await config.save();
    } else {
      config = await Config.create({ key, value });
    }
    res.json({ message: 'Configuration updated successfully', config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all users with filters for Admin Dashboard
// @route   GET /api/admin/users
// @access  Public (Temporary for dev)
const getAdminUsers = async (req, res) => {
  try {
    const query = { role: 'user', deleted: { $ne: true } }; // Retrieve client app users

    if (req.query.district) {
      query.district = { $regex: new RegExp(req.query.district, 'i') };
    }
    if (req.query.state) {
      query.state = { $regex: new RegExp(req.query.state, 'i') };
    }
    if (req.query.serviceType) {
      query.serviceType = req.query.serviceType;
    }
    if (req.query.gender) {
      query.gender = req.query.gender;
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Import users from Excel/JSON
// @route   POST /api/admin/users/import
// @access  Public (Temporary for dev)
const importAdminUsers = async (req, res) => {
  try {
    const usersData = req.body;
    if (!Array.isArray(usersData)) {
      return res.status(400).json({ message: 'Invalid data format. Expected an array of users.' });
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    for (let i = 0; i < usersData.length; i++) {
      const data = usersData[i];
      if (!data.name || !data.email) {
        errors.push(`Row ${i + 1}: Name and Email are required.`);
        continue;
      }

      try {
        let user = await User.findOne({ email: data.email.toLowerCase() });
        if (user) {
          // Update profile fields
          if (data.name) user.name = data.name;
          if (data.gender) user.gender = data.gender;
          if (data.age !== undefined) user.age = Number(data.age) || undefined;
          if (data.dateOfBirth) user.dateOfBirth = String(data.dateOfBirth);
          if (data.area) user.area = data.area;
          if (data.pincode) user.pincode = String(data.pincode);
          if (data.district) user.district = data.district;
          if (data.state) user.state = data.state;
          if (data.serviceType) user.serviceType = data.serviceType;
          if (data.preferredLanguage) user.preferredLanguage = data.preferredLanguage;
          if (data.phoneNumber) user.phoneNumber = String(data.phoneNumber);
          if (data.alternatePhone) user.alternatePhone = String(data.alternatePhone);
          if (data.address) user.address = data.address;
          if (data.emergencyContact) user.emergencyContact = String(data.emergencyContact);
          if (data.fitnessGoal) user.fitnessGoal = data.fitnessGoal;
          
          await user.save();
          updatedCount++;
        } else {
          // Create new user
          const defaultPassword = data.password || 'MrCoach@123';
          user = new User({
            name: data.name,
            email: data.email.toLowerCase(),
            password: defaultPassword,
            role: 'user',
            gender: data.gender,
            age: data.age !== undefined ? (Number(data.age) || undefined) : undefined,
            dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth) : undefined,
            area: data.area,
            pincode: data.pincode ? String(data.pincode) : undefined,
            district: data.district,
            state: data.state,
            serviceType: data.serviceType,
            preferredLanguage: data.preferredLanguage || 'English',
            phoneNumber: data.phoneNumber ? String(data.phoneNumber) : undefined,
            alternatePhone: data.alternatePhone ? String(data.alternatePhone) : undefined,
            address: data.address,
            emergencyContact: data.emergencyContact ? String(data.emergencyContact) : undefined,
            fitnessGoal: data.fitnessGoal
          });

          await user.save();
          createdCount++;
        }
      } catch (err) {
        errors.push(`Row ${i + 1} (${data.email}): ${err.message}`);
      }
    }

    res.json({
      message: 'Import process completed',
      createdCount,
      updatedCount,
      errors
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export OTP-verified customer phone numbers to Excel
// @route   GET /api/admin/users/export-verified-phones
// @access  Public (Temporary for dev)
const exportVerifiedPhoneNumbers = async (req, res) => {
  try {
    const users = await User.find({
      role: 'user',
      deleted: { $ne: true },
      phoneNumber: { $exists: true, $ne: null, $ne: '' }
    });

    const normalizePhone = (num) => {
      if (!num) return null;
      let cleaned = num.toString().replace(/[\s\-\(\)]/g, '');
      if (!cleaned) return null;
      
      if (cleaned.startsWith('+')) {
        return cleaned;
      }
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        return '+' + cleaned;
      }
      if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
        return '+91' + cleaned;
      }
      return cleaned;
    };

    const uniqueNormalizedNumbers = new Set();
    const exportData = [];
    let serialNum = 1;

    for (const user of users) {
      const normalized = normalizePhone(user.phoneNumber);
      if (!normalized) continue;

      if (!uniqueNormalizedNumbers.has(normalized)) {
        uniqueNormalizedNumbers.add(normalized);
        exportData.push({
          'Serial Number': serialNum++,
          'Verified Mobile Number': normalized,
          'User Name': user.name || 'N/A',
          'Registration Date': user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A'
        });
      }
    }

    const XLSX = require('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Serial Number
      { wch: 25 }, // Verified Mobile Number
      { wch: 25 }, // User Name
      { wch: 20 }  // Registration Date
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Verified Phone Numbers');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=verified_phone_numbers.xlsx');

    return res.status(200).send(excelBuffer);
  } catch (error) {
    console.error('Error exporting phone numbers:', error);
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get Admin Dashboard Overview statistics
// @route   GET /api/admin/overview
// @access  Public (Temporary for dev)
const getAdminOverview = async (req, res) => {
  try {
    const timeRange = req.query.range || req.query.timeRange || 'all';
    let dateFilter = {};

    if (timeRange !== 'all') {
      const now = new Date();
      let startDate;
      if (timeRange === '7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'month' || timeRange === '30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      }
      if (startDate) {
        dateFilter = { createdAt: { $gte: startDate } };
      }
    }

    // 1. Total Clients: distinct registered users with role 'user' who have bookings/enquiries
    const clientsResult = await Booking.aggregate([
      {
        $match: dateFilter
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      {
        $unwind: '$userDetails'
      },
      {
        $match: {
          'userDetails.role': 'user'
        }
      },
      {
        $group: {
          _id: '$user'
        }
      },
      {
        $count: 'count'
      }
    ]);
    const totalClients = clientsResult[0]?.count || 0;

    // 2. Free Enquiries: total enquiry submissions (bookingType: 'Enquiry')
    const totalEnquiries = await Booking.countDocuments({
      ...dateFilter,
      bookingType: { $regex: /^enquiry$/i }
    });

    // 3. Paid Demos: only those that are confirmed or completed
    const paidDemos = await Booking.countDocuments({
      ...dateFilter,
      bookingType: { $regex: /^demo$/i },
      status: { $in: ['confirmed', 'completed'] }
    });

    // totalBookings represents the sum of all booking documents
    const totalBookings = await Booking.countDocuments(dateFilter);

    // 4. Total Revenue: sum of price of all confirmed/completed demos (bookingType: 'Demo')
    const revenueResult = await Booking.aggregate([
      {
        $match: {
          ...dateFilter,
          bookingType: { $regex: /^demo$/i },
          status: { $in: ['confirmed', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$price', 99] } }
        }
      }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // 5. Top-Performing Services
    const topServices = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$serviceName',
          bookingCount: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$price', 99] } }
        }
      },
      { $sort: { bookingCount: -1 } }
    ]);

    // 6. City & Area Booking Density
    const cityDensity = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            district: { $ifNull: ['$district', 'Unknown'] },
            area: { $ifNull: ['$area', 'Unknown'] }
          },
          bookingCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          district: '$_id.district',
          area: '$_id.area',
          bookingCount: 1
        }
      },
      { $sort: { bookingCount: -1 } }
    ]);

    // 7. Booking Mode Distribution
    const modeDistribution = await Booking.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $ifNull: ['$mode', 'Unknown'] },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          mode: '$_id',
          count: 1
        }
      }
    ]);

    res.json({
      totalClients,
      totalBookings,
      totalEnquiries,
      paidDemos,
      totalRevenue,
      topServices,
      cityDensity,
      modeDistribution
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user details
// @route   PUT /api/admin/users/:id
// @access  Public (Temporary for dev)
const updateAdminUser = async (req, res) => {
  try {
    const { 
      name, email, phoneNumber, alternatePhone, serviceType, 
      area, district, state, pincode, address,
      gender, startPlan, availableDays, sourceWebsite 
    } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (alternatePhone !== undefined) user.alternatePhone = alternatePhone;
    if (serviceType !== undefined) user.serviceType = serviceType;
    if (area !== undefined) user.area = area;
    if (district !== undefined) user.district = district;
    if (state !== undefined) user.state = state;
    if (pincode !== undefined) user.pincode = pincode;
    if (address !== undefined) user.address = address;
    if (gender !== undefined) user.gender = gender;
    if (startPlan !== undefined) user.startPlan = startPlan;
    if (availableDays !== undefined) user.availableDays = availableDays;
    if (sourceWebsite !== undefined) user.sourceWebsite = sourceWebsite;

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Soft delete user
// @route   DELETE /api/admin/users/:id
// @access  Public (Temporary for dev)
const deleteAdminUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.deleted = true;
    await user.save();
    res.json({ message: 'User soft-deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user detailed profile with bookings, etc.
// @route   GET /api/admin/users/:id/detail
// @access  Public (Temporary for dev)
const getAdminUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('referredBy', 'name email');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch bookings for this user
    const Booking = require('../models/Booking');
    const bookings = await Booking.find({ user: user._id });

    // Try to fetch referrals
    let referrals = [];
    try {
      const Referral = require('../models/Referral');
      referrals = await Referral.find({ referrer: user._id }).populate('referredUser', 'name email');
    } catch (e) {
      // If Referral model doesn't exist, we can fallback to finding other users referredBy this user
      referrals = await User.find({ referredBy: user._id }).select('name email createdAt');
    }

    res.json({
      user,
      bookings,
      referrals
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get synchronized event bookings for Admin Dashboard
// @route   GET /api/admin/event-bookings
// @access  Public (Temporary for dev)
const getAdminEventBookings = async (req, res) => {
  try {
    const query = {};

    // 1. Search Query
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { user_name: searchRegex },
        { user_email: searchRegex },
        { verified_mobile_number: searchRegex },
        { event_title: searchRegex },
        { booking_id: searchRegex },
        { payment_id: searchRegex }
      ];
    }

    // 2. Event Title filter
    if (req.query.event_title) {
      query.event_title = { $regex: new RegExp(req.query.event_title, 'i') };
    }

    // 3. Payment Status filter
    if (req.query.payment_status) {
      query.payment_status = { $regex: new RegExp(req.query.payment_status, 'i') };
    }

    // 4. Date Range filter
    if (req.query.startDate || req.query.endDate) {
      query.booking_date_time = {};
      if (req.query.startDate) {
        query.booking_date_time.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.booking_date_time.$lte = end;
      }
    }

    // 5. Amount Range filter
    if (req.query.minAmount || req.query.maxAmount) {
      query.amount_paid = {};
      if (req.query.minAmount) {
        query.amount_paid.$gte = parseFloat(req.query.minAmount);
      }
      if (req.query.maxAmount) {
        query.amount_paid.$lte = parseFloat(req.query.maxAmount);
      }
    }

    const bookings = await EventBooking.find(query).sort({ booking_date_time: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Event Booking Overview stats for Admin Dashboard
// @route   GET /api/admin/event-bookings/overview
// @access  Public (Temporary for dev)
const getAdminEventOverview = async (req, res) => {
  try {
    const paidQuery = { payment_status: { $regex: /^paid$/i } };

    // 1. Total revenue & total tickets
    const totalsResult = await EventBooking.aggregate([
      { $match: paidQuery },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount_paid' },
          totalTickets: { $sum: '$ticket_quantity' }
        }
      }
    ]);

    const totalRevenue = totalsResult[0]?.totalRevenue || 0;
    const totalTickets = totalsResult[0]?.totalTickets || 0;

    // 2. Total Paid Bookings count
    const paidBookingsCount = await EventBooking.countDocuments(paidQuery);

    // 3. Total Attendees (Unique phone numbers of paid bookings)
    const uniqueAttendees = await EventBooking.distinct('verified_mobile_number', paidQuery);
    const totalAttendees = uniqueAttendees.length;

    // 4. Top Performing Event
    const topEventResult = await EventBooking.aggregate([
      { $match: paidQuery },
      {
        $group: {
          _id: '$event_title',
          ticketsSold: { $sum: '$ticket_quantity' },
          revenue: { $sum: '$amount_paid' }
        }
      },
      { $sort: { ticketsSold: -1 } },
      { $limit: 1 }
    ]);

    const topPerformingEvent = topEventResult[0] 
      ? { title: topEventResult[0]._id, ticketsSold: topEventResult[0].ticketsSold, revenue: topEventResult[0].revenue }
      : { title: 'N/A', ticketsSold: 0, revenue: 0 };

    res.json({
      totalRevenue,
      totalTicketsSold: totalTickets,
      totalAttendees,
      paidBookingsCount,
      topPerformingEvent
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete booking for Admin Dashboard
// @route   DELETE /api/admin/bookings/:id
// @access  Public (Temporary for dev)
const deleteAdminBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (booking) {
      res.json({ message: 'Booking deleted successfully' });
    } else {
      res.status(404).json({ message: 'Booking not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminBookings,
  updateAdminService,
  deleteAdminService,
  adminLogin,
  getAdminSlots,
  createAdminSlot,
  deleteAdminSlot,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  changeAdminPassword,
  getAdminConfigs,
  updateAdminConfig,
  getAdminUsers,
  importAdminUsers,
  getAdminOverview,
  updateAdminUser,
  deleteAdminUser,
  getAdminUserDetail,
  getAdminEventBookings,
  getAdminEventOverview,
  exportVerifiedPhoneNumbers,
  deleteAdminBooking
};
