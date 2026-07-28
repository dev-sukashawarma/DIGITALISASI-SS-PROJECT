function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sa = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
             Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
             Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

const humamGps = { lat: -6.562316, lng: 106.861020 };
const newSentulCoords = { lat: -6.562316, lng: 106.861020 };

const dist = haversineMeters(humamGps, newSentulCoords);
console.log(`Calculated distance for Humam at MITRA SENTUL: ${dist.toFixed(2)} meters`);
