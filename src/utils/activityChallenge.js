const { validateLocationPoint } = require('./virtualRunTracking');

const ACTIVITY_TYPES = ['walking', 'running', 'cycling'];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOnly = (value, endOfDay = false) => {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() !== month - 1 ||
    start.getUTCDate() !== day
  ) {
    return null;
  }
  if (endOfDay) start.setUTCHours(23, 59, 59, 999);
  return start;
};

const dateOnlyString = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};

const validateActivityChallengeInput = (input, existing = null) => {
  const value = { ...(existing || {}), ...input };
  const startDateString =
    input.startDate !== undefined
      ? input.startDate
      : dateOnlyString(existing?.startDate);
  const endDateString =
    input.endDate !== undefined
      ? input.endDate
      : dateOnlyString(existing?.endDate);
  const startDate = parseDateOnly(startDateString);
  const endDate = parseDateOnly(endDateString, true);
  const title = String(value.title ?? value.name ?? existing?.title ?? '').trim();
  const allowedActivityTypes = value.allowedActivityTypes;
  const minDurationMinutes = Number(value.minDurationMinutes);
  const progressMetric = value.progressMetric;
  const requiredActivityCount = Number(value.requiredActivityCount);
  const rewardCoins = Number(value.rewardCoins ?? 0);
  const badgeName = String(value.badgeName ?? '').trim();
  const minDistanceKm =
    value.minDistanceKm == null || value.minDistanceKm === ''
      ? undefined
      : Number(value.minDistanceKm);
  const maxParticipants =
    value.maxParticipants == null || value.maxParticipants === ''
      ? undefined
      : Number(value.maxParticipants);
  const organizer = value.organizer || {};
  const email = String(organizer.email ?? '').trim().toLowerCase();

  if (!startDate || !endDate || endDate < startDate) {
    return { error: 'startDate and endDate must be valid YYYY-MM-DD dates, with endDate on or after startDate.' };
  }
  if (
    !Array.isArray(allowedActivityTypes) ||
    allowedActivityTypes.length === 0 ||
    allowedActivityTypes.some(type => !ACTIVITY_TYPES.includes(type)) ||
    new Set(allowedActivityTypes).size !== allowedActivityTypes.length
  ) {
    return { error: 'allowedActivityTypes must contain unique walking, running, or cycling values.' };
  }
  if (!Number.isInteger(minDurationMinutes) || minDurationMinutes < 1 || minDurationMinutes > 1440) {
    return { error: 'minDurationMinutes must be a whole number from 1 to 1440.' };
  }
  if (
    minDistanceKm !== undefined &&
    (!Number.isFinite(minDistanceKm) || minDistanceKm <= 0 || minDistanceKm > 1000)
  ) {
    return { error: 'minDistanceKm must be greater than 0 and no more than 1000.' };
  }
  if (!['days', 'sessions'].includes(progressMetric)) {
    return { error: "progressMetric must be 'days' or 'sessions'." };
  }
  if (!Number.isInteger(requiredActivityCount) || requiredActivityCount < 1 || requiredActivityCount > 10000) {
    return { error: 'requiredActivityCount must be a whole number from 1 to 10000.' };
  }
  if (!Number.isInteger(rewardCoins) || rewardCoins < 0 || rewardCoins > 100000) {
    return { error: 'rewardCoins must be a whole number from 0 to 100000.' };
  }
  if (badgeName.length > 100) {
    return { error: 'badgeName cannot exceed 100 characters.' };
  }
  if (maxParticipants !== undefined && (!Number.isInteger(maxParticipants) || maxParticipants < 1)) {
    return { error: 'maxParticipants must be a positive whole number.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'organizer.email must be a valid email address.' };
  }

  const name = title || `Activity Challenge ${startDateString}`;
  return {
    value: {
      name,
      title: name,
      description: String(value.description ?? '').trim(),
      slug: String(value.slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`),
      image: value.image || value.bannerImage || '',
      bannerImage: String(value.bannerImage ?? value.image ?? '').trim(),
      organizer: {
        name: String(organizer.name ?? '').trim(),
        email
      },
      startDate,
      endDate,
      location: 'Virtual',
      locationName: 'Virtual',
      price: 0,
      category: String(value.category || 'Activity Challenge'),
      eventType: 'activityChallenge',
      allowedActivityTypes: [...allowedActivityTypes],
      minDurationMinutes,
      ...(minDistanceKm === undefined ? {} : { minDistanceKm }),
      progressMetric,
      requiredActivityCount,
      rewardCoins,
      badgeName,
      maxParticipants,
      status: value.status || 'upcoming',
      publicationStatus: value.publicationStatus || 'published'
    }
  };
};

const estimateActivity = (points, event, now = Date.now()) => {
  if (!Array.isArray(points) || points.length < 2 || points.length > 1000) {
    return { error: 'Upload between 2 and 1000 GPS points.' };
  }

  let previous = null;
  let lastSequence = -1;
  let distanceMeters = 0;
  let suspiciousSpeed = false;
  for (const input of points) {
    const sequence = Number(input?.sequence);
    if (!Number.isSafeInteger(sequence) || sequence <= lastSequence) {
      return { error: 'Location sequence numbers must strictly increase.' };
    }
    const result = validateLocationPoint(input, previous, now);
    if (!result.valid) return { error: result.reason };
    if (
      result.point.timestamp < event.startDate ||
      result.point.timestamp > event.endDate
    ) {
      return { error: 'GPS points must fall within the challenge date range.' };
    }
    if (result.filtered && !result.updateBaseline) suspiciousSpeed = true;
    distanceMeters += result.distanceMeters;
    if (result.updateBaseline) previous = result.point;
    lastSequence = sequence;
  }

  const firstTimestamp = new Date(points[0].timestamp).getTime();
  const lastTimestamp = new Date(points[points.length - 1].timestamp).getTime();
  const durationSeconds = (lastTimestamp - firstTimestamp) / 1000;
  if (durationSeconds <= 0) return { error: 'GPS points must cover a positive duration.' };
  return {
    value: {
      startedAt: new Date(firstTimestamp),
      finishedAt: new Date(lastTimestamp),
      durationMinutes: durationSeconds / 60,
      distanceKm: distanceMeters / 1000,
      gpsPointCount: points.length,
      suspiciousSpeed
    }
  };
};

const activityQualifies = (activity, event) =>
  activity.durationMinutes >= event.minDurationMinutes &&
  (event.minDistanceKm == null || activity.distanceKm >= event.minDistanceKm);

module.exports = {
  ACTIVITY_TYPES,
  activityQualifies,
  dateOnlyString,
  estimateActivity,
  parseDateOnly,
  validateActivityChallengeInput
};
