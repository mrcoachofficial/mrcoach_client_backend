const ARRIVAL_THRESHOLD_METERS = 50;
const MAX_LOCATION_ACCURACY_METERS = 25;
const MAX_LOCATION_AGE_MS = 30_000;
const MAX_FUTURE_LOCATION_MS = 5_000;

function isValidCoordinate(coordinate) {
  return coordinate &&
    Number.isFinite(Number(coordinate.latitude)) &&
    Number.isFinite(Number(coordinate.longitude)) &&
    Number(coordinate.latitude) >= -90 &&
    Number(coordinate.latitude) <= 90 &&
    Number(coordinate.longitude) >= -180 &&
    Number(coordinate.longitude) <= 180;
}

function distanceBetweenMeters(first, second) {
  const radians = (degrees) => degrees * (Math.PI / 180);
  const latitudeDifference = radians(Number(second.latitude) - Number(first.latitude));
  const longitudeDifference = radians(Number(second.longitude) - Number(first.longitude));
  const firstLatitude = radians(Number(first.latitude));
  const secondLatitude = radians(Number(second.latitude));
  const haversine = Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
    Math.cos(secondLatitude) *
    Math.sin(longitudeDifference / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function validateDestinationArrival(destination, location, now = Date.now()) {
  if (!isValidCoordinate(destination)) {
    return { valid: false, reason: 'The challenge destination is invalid' };
  }
  if (!isValidCoordinate(location)) {
    return { valid: false, reason: 'Unable to verify your location. Please enable GPS and try again.' };
  }

  const accuracy = Number(location.accuracy);
  const timestamp = new Date(location.timestamp).getTime();
  if (!Number.isFinite(accuracy) ||
      accuracy < 0 ||
      accuracy > MAX_LOCATION_ACCURACY_METERS ||
      !Number.isFinite(timestamp) ||
      now - timestamp > MAX_LOCATION_AGE_MS ||
      timestamp - now > MAX_FUTURE_LOCATION_MS) {
    return { valid: false, reason: 'Unable to verify your location. Please enable GPS and try again.' };
  }

  const distanceMeters = distanceBetweenMeters(destination, location);
  return {
    valid: distanceMeters <= ARRIVAL_THRESHOLD_METERS,
    distanceMeters,
    reason: distanceMeters <= ARRIVAL_THRESHOLD_METERS
      ? null
      : "You haven't reached your destination yet. Please reach the destination to complete the challenge and earn your rewards."
  };
}

module.exports = {
  ARRIVAL_THRESHOLD_METERS,
  isValidCoordinate,
  validateDestinationArrival
};
