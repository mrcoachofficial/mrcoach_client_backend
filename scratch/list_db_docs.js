const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const inspectDb = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not found in environment');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    // Define temporary schemas for listing
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema, 'users');

    const bookingSchema = new mongoose.Schema({}, { strict: false });
    const Booking = mongoose.model('Booking', bookingSchema, 'bookings');

    const users = await User.find({});
    console.log('--- USERS IN DATABASE ---');
    users.forEach((u, i) => {
      console.log(`${i + 1}. ID: ${u._id} | Name: ${u.name} | Email: ${u.email} | Phone: ${u.phoneNumber} | CreatedAt: ${u.createdAt}`);
    });

    const bookings = await Booking.find({});
    console.log('\n--- BOOKINGS IN DATABASE ---');
    bookings.forEach((b, i) => {
      console.log(`${i + 1}. ID: ${b._id} | User ID: ${b.user} | Service: ${b.serviceName} | Date: ${b.date} | Phone: ${b.mobileNumber}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Database connection error:', error);
  }
};

inspectDb();
