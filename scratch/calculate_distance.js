function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const outletLat = -6.7851251;
const outletLng = 106.7812358;

const rezaLatScreen = -6.783364;
const rezaLngScreen = 106.782085;

const distanceMeters = getDistance(outletLat, outletLng, rezaLatScreen, rezaLngScreen);
console.log(`Distance between outlet (-6.7851251, 106.7812358) and Reza (-6.783364, 106.782085):`);
console.log(`${distanceMeters.toFixed(2)} meters`);
