const MAX_LOCATION_ACCURACY_METERS = 25;
const MAX_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5000;
const MAX_SPEED_METERS_PER_SECOND = 12;

const isValidCoordinate = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const distanceBetweenMeters = (first, second) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const latitude1 = radians(first.latitude);
  const latitude2 = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const validateLocationPoint = (input, previous, now = Date.now()) => {
  const latitude = Number(input?.latitude);
  const longitude = Number(input?.longitude);
  const accuracy = Number(input?.accuracy);
  const timestamp = new Date(input?.timestamp);
  const sequence = Number(input?.sequence);

  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    return { valid: false, reason: 'Each location point requires a non-negative sequence number.' };
  }
  if (!isValidCoordinate(latitude, longitude)) {
    return { valid: false, reason: 'Location coordinates are invalid.' };
  }
  if (!Number.isFinite(accuracy) || accuracy <= 0 || accuracy > MAX_LOCATION_ACCURACY_METERS) {
    return { valid: false, reason: 'Location accuracy is insufficient for verification.' };
  }
  if (!Number.isFinite(timestamp.getTime()) ||
      timestamp.getTime() > now + MAX_FUTURE_CLOCK_SKEW_MS ||
      timestamp.getTime() < now - MAX_LOCATION_AGE_MS) {
    return { valid: false, reason: 'Location timestamp is invalid or too old.' };
  }

  const point = { sequence, latitude, longitude, accuracy, timestamp };
  if (!previous) {
    return {
      valid: true,
      point,
      distanceMeters: 0,
      filtered: false,
      updateBaseline: true
    };
  }
  if (timestamp.getTime() <= new Date(previous.timestamp).getTime()) {
    return { valid: false, reason: 'Location timestamps must be strictly increasing.' };
  }

  const distanceMeters = distanceBetweenMeters(previous, point);
  const elapsedSeconds =
    (timestamp.getTime() - new Date(previous.timestamp).getTime()) / 1000;
  if (elapsedSeconds <= 0 || distanceMeters / elapsedSeconds > MAX_SPEED_METERS_PER_SECOND) {
    return {
      valid: true,
      point,
      distanceMeters: 0,
      filtered: true,
      updateBaseline: false
    };
  }

  const noiseThreshold = Math.max(3, (previous.accuracy + accuracy) / 2);
  return {
    valid: true,
    point,
    distanceMeters: distanceMeters > noiseThreshold ? distanceMeters : 0,
    filtered: distanceMeters <= noiseThreshold,
    updateBaseline: true
  };
};

module.exports = {
  MAX_LOCATION_ACCURACY_METERS,
  MAX_LOCATION_AGE_MS,
  MAX_FUTURE_CLOCK_SKEW_MS,
  MAX_SPEED_METERS_PER_SECOND,
  distanceBetweenMeters,
  isValidCoordinate,
  validateLocationPoint
};
