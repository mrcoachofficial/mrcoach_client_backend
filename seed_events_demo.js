const path = require('node:path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Event = require('./src/models/Event');

dotenv.config({ path: path.join(__dirname, '.env') });

const DEMO_SLUG_PREFIX = 'demo-weekly-sunday-run-';
const CHENNAI_TIME_ZONE = 'Asia/Kolkata';

const upcomingSunday = (fromDate, weeksAhead) => {
  const localDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHENNAI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(fromDate);
  const parts = Object.fromEntries(
    localDateParts.map(({ type, value }) => [type, value])
  );
  const localDate = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
  );
  const daysUntilSunday = (7 - localDate.getUTCDay()) % 7 || 7;
  localDate.setUTCDate(
    localDate.getUTCDate() + daysUntilSunday + weeksAhead * 7
  );

  // 00:30 UTC is 06:00 in Chennai (IST).
  return new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      0,
      30
    )
  );
};

const demoEventTemplates = [
  {
    title: 'Marina Sunrise Run',
    locationName: 'Marina Beach, Lighthouse Entrance',
    lat: 13.0501,
    lng: 80.2824,
    maxParticipants: 80,
    organizer: { name: 'MrCoach Chennai', email: 'events@mrcoach.in' }
  },
  {
    title: 'Besant Nagar Beach Run',
    locationName: 'Elliot’s Beach, Besant Nagar',
    lat: 12.9988,
    lng: 80.271,
    maxParticipants: 60,
    organizer: { name: 'Coastal Runners Chennai' }
  },
  {
    title: 'Anna Nagar Park Run',
    locationName: 'Anna Nagar Tower Park',
    lat: 13.085,
    lng: 80.2101,
    maxParticipants: 50,
    organizer: { name: 'Anna Nagar Run Club' }
  },
  {
    title: 'Semmozhi Green Run',
    locationName: 'Semmozhi Poonga Main Gate',
    lat: 13.0555,
    lng: 80.2497,
    maxParticipants: 70,
    organizer: { name: 'Green Miles Chennai' }
  },
  {
    title: 'Adyar Sunday Social Run',
    locationName: 'Adyar Eco Park Entrance',
    lat: 13.0067,
    lng: 80.257,
    maxParticipants: 45,
    organizer: { name: 'Adyar Social Runners' }
  }
];

const makeDemoEvent = (template, index, now) => {
  const startDateTime = upcomingSunday(now, index);
  const endDate = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
  const imageUrl =
    `https://placehold.co/1200x600/F9C314/2F7D52?text=` +
    encodeURIComponent(template.title);
  const slug = `${DEMO_SLUG_PREFIX}${index + 1}`;

  return {
    title: template.title,
    name: template.title,
    slug,
    sport: 'Running',
    format: 'In person',
    startDateTime,
    recurrence: 'Weekly on Sunday',
    startDate: startDateTime,
    endDate,
    locationName: template.locationName,
    location: `${template.locationName}, Chennai`,
    city: 'Chennai',
    lat: template.lat,
    lng: template.lng,
    bannerImage: imageUrl,
    image: imageUrl,
    maxParticipants: template.maxParticipants,
    organizer: template.organizer,
    participants: [],
    status: 'upcoming',
    price: 0,
    category: 'Running',
    eventType: 'inPerson',
    targetDistance: 5,
    targetDistanceKm: 5,
    publicationStatus: 'published',
    websiteUrl: ''
  };
};

const seedDemoEvents = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not defined in backend/.env.');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const filter = { slug: new RegExp(`^${DEMO_SLUG_PREFIX}`) };
  const deleted = await Event.deleteMany(filter);
  const now = new Date();
  const events = demoEventTemplates.map((template, index) =>
    makeDemoEvent(template, index, now)
  );
  await Event.insertMany(events);
  console.log(
    `Seeded ${events.length} upcoming Sunday events in Chennai ` +
      `(removed ${deleted.deletedCount} previous demo events).`
  );
};

seedDemoEvents()
  .catch(error => {
    console.error('Could not seed demo events:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
