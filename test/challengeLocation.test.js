const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDestinationArrival } = require('../src/utils/challengeLocation');

const now = Date.parse('2026-10-15T10:00:00.000Z');
const destination = { latitude: 13.0827, longitude: 80.2707 };

function location(latitude, longitude, overrides = {}) {
  return {
    latitude,
    longitude,
    accuracy: 10,
    timestamp: now,
    ...overrides
  };
}

test('accepts a fresh accurate location within the arrival threshold', () => {
  const result = validateDestinationArrival(
    destination,
    location(destination.latitude, destination.longitude),
    now
  );

  assert.equal(result.valid, true);
});

test('rejects a location at the source or outside the destination threshold', () => {
  const result = validateDestinationArrival(
    destination,
    location(13.0800, 80.2707),
    now
  );

  assert.equal(result.valid, false);
  assert.match(result.reason, /haven't reached your destination/);
});

test('uses the configured 50 metre arrival boundary', () => {
  const inside = validateDestinationArrival(
    destination,
    location(destination.latitude + 0.00044, destination.longitude),
    now
  );
  const outside = validateDestinationArrival(
    destination,
    location(destination.latitude + 0.00046, destination.longitude),
    now
  );

  assert.equal(inside.valid, true);
  assert.equal(outside.valid, false);
});

test('rejects inaccurate and stale GPS readings', () => {
  const inaccurate = validateDestinationArrival(
    destination,
    location(destination.latitude, destination.longitude, { accuracy: 26 }),
    now
  );
  const stale = validateDestinationArrival(
    destination,
    location(destination.latitude, destination.longitude, { timestamp: now - 30_001 }),
    now
  );

  assert.equal(inaccurate.valid, false);
  assert.match(inaccurate.reason, /Unable to verify your location/);
  assert.equal(stale.valid, false);
  assert.match(stale.reason, /Unable to verify your location/);
});

test('rejects missing or invalid coordinates', () => {
  const result = validateDestinationArrival(destination, location(91, 80), now);

  assert.equal(result.valid, false);
  assert.match(result.reason, /Unable to verify your location/);
});
