const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Event = require('../src/models/Event');
const {
  buildEventLeaderboard,
  isEventFull,
  parseEventCalendarDate
} = require('../src/controllers/eventController');

test('Event stores the requested event fields and participant results', () => {
  const event = new Event({
    name: 'City Run',
    title: 'City Run',
    slug: 'city-run',
    description: 'A community running event',
    bannerImage: 'https://example.com/city-run.jpg',
    maxParticipants: 100,
    sport: 'Running',
    format: 'In person',
    startDateTime: new Date('2026-11-01T08:00:00Z'),
    recurrence: 'Weekly on Sunday',
    locationName: 'Marina Beach',
    city: 'Chennai',
    lat: 13.0501,
    lng: 80.2824,
    organizer: { name: 'MrCoach Chennai' },
    targetDistance: 10,
    startDate: new Date('2026-11-01T08:00:00Z'),
    endDate: new Date('2026-11-01T12:00:00Z'),
    rules: 'Complete the full distance.',
    rewards: 'Finisher medal',
    status: 'active',
    participants: [{
      userId: new mongoose.Types.ObjectId(),
      status: 'completed',
      distance: 10.5,
      time: 3600
    }]
  });

  assert.equal(event.validateSync(), undefined);
  assert.equal(event.name, 'City Run');
  assert.equal(event.targetDistance, 10);
  assert.equal(event.bannerImage, 'https://example.com/city-run.jpg');
  assert.equal(event.maxParticipants, 100);
  assert.equal(event.sport, 'Running');
  assert.equal(event.format, 'In person');
  assert.equal(event.recurrence, 'Weekly on Sunday');
  assert.equal(event.locationName, 'Marina Beach');
  assert.equal(event.city, 'Chennai');
  assert.equal(event.lat, 13.0501);
  assert.equal(event.lng, 80.2824);
  assert.equal(event.organizer.name, 'MrCoach Chennai');
  assert.equal(event.participants.length, 1);
  assert.equal(event.participants[0].time, 3600);
});

test('event calendar dates keep both startDate and endDate, including the same day', () => {
  const start = parseEventCalendarDate('2026-12-01');
  const sameDayEnd = parseEventCalendarDate('2026-12-01', true);
  const laterEnd = parseEventCalendarDate('2026-12-05', true);

  assert.ok(start);
  assert.ok(sameDayEnd);
  assert.ok(laterEnd);
  assert.equal(start.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(sameDayEnd.toISOString().slice(0, 10), '2026-12-01');
  assert.equal(laterEnd.toISOString().slice(0, 10), '2026-12-05');
  assert.ok(sameDayEnd >= start);
  assert.ok(laterEnd > start);
  assert.equal(parseEventCalendarDate('not-a-date'), null);
});

test('event capacity is full only after reaching a configured limit', () => {
  assert.equal(isEventFull(9, 10), false);
  assert.equal(isEventFull(10, 10), true);
  assert.equal(isEventFull(12, 10), true);
  assert.equal(isEventFull(100, undefined), false);
});

test('event leaderboard ranks completed qualifying results by fastest time', () => {
  const leaderboard = buildEventLeaderboard([
    {
      userId: { _id: 'slow-user', name: 'Slow Runner' },
      status: 'completed',
      distance: 10,
      time: 4200
    },
    {
      userId: { _id: 'fast-user', name: 'Fast Runner' },
      status: 'completed',
      distance: 11,
      time: 3600
    },
    {
      userId: { _id: 'short-user', name: 'Short Runner' },
      status: 'completed',
      distance: 9,
      time: 1800
    },
    {
      userId: { _id: 'joined-user', name: 'Joined Runner' },
      status: 'joined',
      distance: 0,
      time: null
    }
  ], 10);

  assert.deepEqual(
    leaderboard.map(({ rank, userId, time }) => ({ rank, userId, time })),
    [
      { rank: 1, userId: 'fast-user', time: 3600 },
      { rank: 2, userId: 'slow-user', time: 4200 }
    ]
  );
});
