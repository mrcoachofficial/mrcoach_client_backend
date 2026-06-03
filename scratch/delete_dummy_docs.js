const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const deleteEverythingExceptAdmin = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI not found in environment');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    // Define temporary schemas
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');

    // 1. Delete all users except Super Admin
    const deleteUsersResult = await User.deleteMany({
      email: { $ne: 'admin@mrcoach.in' }
    });
    console.log(`Successfully deleted ${deleteUsersResult.deletedCount} users.`);

    // 2. Delete all bookings
    const deleteBookingsResult = await Booking.deleteMany({});
    console.log(`Successfully deleted ${deleteBookingsResult.deletedCount} bookings.`);

    await mongoose.disconnect();
    console.log('\nDatabase cleanup complete. Only Super Admin remains.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

deleteEverythingExceptAdmin();
