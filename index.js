const dns = require('node:dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./src/config/db');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount routers
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/profile', require('./src/routes/profileRoutes'));
app.use('/api/bookings', require('./src/routes/bookingRoutes'));
app.use('/api/services', require('./src/routes/serviceRoutes'));
app.use('/api/payment', require('./src/routes/paymentRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));
app.use('/api/upload', require('./src/routes/uploadRoutes'));
app.use('/api/rewards', require('./src/routes/rewardRoutes'));
app.use('/api/referrals', require('./src/routes/referralRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/events', require('./src/routes/eventRoutes'));
app.use('/api/home-banners', require('./src/routes/homeBannerRoutes'));
app.use('/api/service-media', require('./src/routes/serviceMediaRoutes'));
app.use('/api/products', require('./src/routes/productRoutes'));

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Basic route
app.get('/', (req, res) => {
  res.send('MrCoach API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
