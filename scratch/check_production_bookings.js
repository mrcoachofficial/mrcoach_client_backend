const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const EventBooking = require('../src/models/EventBooking');
const EventSyncLog = require('../src/models/EventSyncLog');

async function run() {
  console.log("Connecting to live Database...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  console.log("\n--- ALL SYNCED EVENT BOOKINGS IN DATABASE ---");
  const bookings = await EventBooking.find().sort({ syncedAt: -1 });
  if (bookings.length === 0) {
    console.log("No synced event bookings found.");
  } else {
    bookings.forEach((b, index) => {
      console.log(`\n[Booking #${index + 1}]`);
      console.log(`Synced At: ${b.syncedAt}`);
      console.log(`Customer: ${b.user_name} (${b.verified_mobile_number} / ${b.user_email})`);
      console.log(`Event: ${b.event_title} (${b.event_id})`);
      console.log(`Amount: ${b.amount_paid} ${b.currency} (Tickets: ${b.ticket_quantity})`);
      console.log(`Payment Status: ${b.payment_status}`);
      console.log(`Payment ID: ${b.payment_id}`);
      console.log(`Source: ${b.booking_source}`);
    });
  }

  console.log("\n--- LATEST 5 SYNC LOGS IN DATABASE ---");
  const logs = await EventSyncLog.find().sort({ createdAt: -1 }).limit(5);
  logs.forEach((l, index) => {
    console.log(`\n[Log #${index + 1}]`);
    console.log(`Time: ${l.createdAt}`);
    console.log(`Status: ${l.status}`);
    console.log(`IP: ${l.ipAddress}`);
    console.log(`Error: ${l.errorMessage || 'None'}`);
    console.log(`Customer: ${l.requestPayload?.user_name || 'N/A'}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
