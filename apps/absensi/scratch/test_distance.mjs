function haversineMeters(a, b) {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const GEOFENCE_RADIUS_M = 100;
const outlet = { lat: -6.7851251, lng: 106.7812358 };

// Titik simulasi real case (misal: posisi di area depan outlet, ~25m dari titik acuan database)
const userLocation = { lat: -6.785300, lng: 106.781400 };
const accuracy = 12.5; // GPS accuracy wajar HP

const distance = haversineMeters(outlet, userLocation);
const adjustedDistance = Math.max(0, distance - accuracy);
const isWithin = adjustedDistance <= GEOFENCE_RADIUS_M;

console.log(`Outlet Coords: ${outlet.lat}, ${outlet.lng}`);
console.log(`User Coords:   ${userLocation.lat}, ${userLocation.lng}`);
console.log(`Raw Distance: ${distance.toFixed(2)} meters`);
console.log(`GPS Accuracy: ${accuracy} meters`);
console.log(`Adjusted Distance: ${adjustedDistance.toFixed(2)} meters`);
console.log(`Geofence Radius: ${GEOFENCE_RADIUS_M} meters`);
console.log(`Valid within geofence: ${isWithin}`);
