const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Clean up duplicate null/empty email keys
    const db = conn.connection.db;
    const usersCollection = db.collection('users');
    await usersCollection.updateMany(
      { $or: [{ email: null }, { email: "" }] },
      { $unset: { email: "" } }
    );

    // Drop the old index so mongoose can recreate it as a sparse index
    try {
      await usersCollection.dropIndex('email_1');
      console.log('Successfully dropped old email_1 index');
    } catch (indexError) {
      // Index might not exist, ignore
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
