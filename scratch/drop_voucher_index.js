const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  try {
    console.log('Connecting to MongoDB: ' + process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const collection = mongoose.connection.collection('vouchers');
    
    // List indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop voucherCode unique index if it exists
    const hasVoucherCodeIndex = indexes.some(idx => idx.name === 'voucherCode_1');
    if (hasVoucherCodeIndex) {
      console.log('Dropping index: voucherCode_1');
      await collection.dropIndex('voucherCode_1');
      console.log('Index dropped successfully.');
    } else {
      console.log('No unique index voucherCode_1 found.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected.');
  }
}

run();
