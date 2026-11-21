const test = require('node:test');
const assert = require('node:assert/strict');
const { compareParticipants } = require('../src/services/virtualRunSettlement');

const participant = (bestTimeMs, bestAccuracyMeters, completedAt, _id) => ({
  bestTimeMs,
  bestAccuracyMeters,
  completedAt: new Date(completedAt),
  _id
});

test('ranks a faster valid target-completion time first', () => {
  const faster = participant(1_200_000, 8, '2026-10-16T10:10:00Z', 'b');
  const moreAccurateButSlower = participant(
    1_200_001,
    2,
    '2026-10-16T10:09:00Z',
    'a'
  );

  assert.ok(compareParticipants(faster, moreAccurateButSlower) < 0);
});

test('uses better GPS accuracy to break equal target-completion times', () => {
  const accurate = participant(1_200_000, 3, '2026-10-16T10:10:00Z', 'b');
  const lessAccurate = participant(1_200_000, 8, '2026-10-16T10:09:00Z', 'a');

  assert.ok(compareParticipants(accurate, lessAccurate) < 0);
});

test('uses server completion time and stable id after accuracy also ties', () => {
  const earlier = participant(1_200_000, 3, '2026-10-16T10:10:00Z', 'z');
  const later = participant(1_200_000, 3, '2026-10-16T10:10:01Z', 'a');
  const idTie = participant(1_200_000, 3, '2026-10-16T10:10:00Z', 'a');

  assert.ok(compareParticipants(earlier, later) < 0);
  assert.ok(compareParticipants(idTie, earlier) < 0);
});
