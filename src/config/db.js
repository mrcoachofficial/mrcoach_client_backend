const mongoose = require('mongoose');

const ensureEmailIndex = async usersCollection => {
  try {
    await usersCollection.createIndex(
      { email: 1 },
      { unique: true, sparse: true, name: 'email_1' }
    );
    console.log('Ensured sparse email_1 index');
  } catch (error) {
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      // Legacy data contains duplicate emails, so uniqueness cannot be
      // enforced yet. Keep a fast lookup index instead of dropping indexes.
      await usersCollection
        .createIndex({ email: 1 }, { name: 'email_lookup' })
        .catch(() => {});
      console.log(
        'Duplicate emails found; using non-unique email_lookup index'
      );
      return;
    }
    if (
      error.codeName === 'IndexOptionsConflict' ||
      /already exists with different options/i.test(error.message)
    ) {
      console.log('email index already exists; leaving it unchanged');
      return;
    }
    console.error(`Could not ensure email index: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    const db = conn.connection.db;
    const usersCollection = db.collection('users');

    // Clean up duplicate null/empty email keys before touching indexes.
    await usersCollection.updateMany(
      { $or: [{ email: null }, { email: '' }] },
      { $unset: { email: '' } }
    );

    await ensureEmailIndex(usersCollection);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
