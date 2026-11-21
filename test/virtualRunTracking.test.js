const test = require('node:test');
const assert = require('node:assert/strict');
const {
  distanceBetweenMeters,
  isValidCoordinate,
  validateLocationPoint
} = require('../src/utils/virtualRunTracking');

const now = Date.parse('2026-10-16T10:00:00.000Z');
const validPoint = (sequence, latitude, longitude, timestamp, accuracy = 5) => ({
  sequence,
  latitude,
  longitude,
  timestamp: new Date(timestamp).toISOString(),
  accuracy
});

test('accepts valid coordinates and rejects out-of-range coordinates', () => {
  assert.equal(isValidCoordinate(13.0827, 80.2707), true);
  assert.equal(isValidCoordinate(91, 80.2707), false);
  assert.equal(isValidCoordinate(13.0827, -181), false);
});

test('measures geographic distance in metres', () => {
  const distance = distanceBetweenMeters(
    { latitude: 13.0827, longitude: 80.2707 },
    { latitude: 13.0837, longitude: 80.2707 }
  );
  assert.ok(distance > 100 && distance < 115);
});

test('accepts an accurate first GPS point as the tracking baseline', () => {
  const result = validateLocationPoint(
    validPoint(0, 13.0827, 80.2707, now),
    null,
    now
  );
  assert.equal(result.valid, true);
  assert.equal(result.distanceMeters, 0);
  assert.equal(result.updateBaseline, true);
});

test('counts plausible movement but filters GPS jitter', () => {
  const previous = {
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 5,
    timestamp: new Date(now)
  };
  const moved = validateLocationPoint(
    validPoint(1, 13.0832, 80.2707, now + 30_000),
    previous,
    now + 30_000
  );
  const jitter = validateLocationPoint(
    validPoint(1, 13.08271, 80.2707, now + 30_000),
    previous,
    now + 30_000
  );
  assert.ok(moved.distanceMeters > 50);
  assert.equal(jitter.distanceMeters, 0);
  assert.equal(jitter.updateBaseline, true);
});

test('filters impossible speed without moving the server baseline', () => {
  const previous = {
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 5,
    timestamp: new Date(now)
  };
  const result = validateLocationPoint(
    validPoint(1, 13.183, 80.2707, now + 1000),
    previous,
    now + 1000
  );
  assert.equal(result.valid, true);
  assert.equal(result.filtered, true);
  assert.equal(result.distanceMeters, 0);
  assert.equal(result.updateBaseline, false);
});

test('rejects poor accuracy, stale/future timestamps, and non-increasing timestamps', () => {
  const previous = {
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 5,
    timestamp: new Date(now)
  };
  assert.equal(
    validateLocationPoint(validPoint(1, 13.0828, 80.2707, now + 10_000, 30), previous, now + 10_000).valid,
    false
  );
  assert.equal(
    validateLocationPoint(validPoint(1, 13.0828, 80.2707, now - 25 * 60 * 60 * 1000), null, now).valid,
    false
  );
  assert.equal(
    validateLocationPoint(validPoint(1, 13.0828, 80.2707, now + 10_000), null, now).valid,
    false
  );
  assert.equal(
    validateLocationPoint(validPoint(1, 13.0828, 80.2707, now), previous, now).valid,
    false
  );
});
