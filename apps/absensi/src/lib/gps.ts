/**
 * Geolokasi untuk validasi radius absensi (M1).
 *
 * Catatan: nilai dari client dipakai untuk UX/preview saja. Keputusan
 * "absen sah/tidak" difinalkan server (Edge Function submit-attendance)
 * yang menghitung ulang jarak dari outlets.lat/lng — lihat spec M1 §5.
 */

export type LatLng = { lat: number; lng: number };

/**
 * Radius geofence absensi (meter) — sumber tunggal dipakai client & server.
 *
 * Dipilih 150 m, bukan ketat (4–25 m), karena kiosk absensi berada DI DALAM
 * gedung: GPS indoor lazim melenceng 30–100 m walau koordinat outlet benar.
 * Radius ketat membuat staf yang benar-benar di lokasi sering ditolak.
 * Catatan: radius tidak bisa menambal koordinat outlet yang salah — outlet
 * harus dikalibrasi ke titik gedung sebenarnya (tombol "Jadikan Ini Lokasi
 * Outlet" / kolom outlets.lat,lng). Outlet dengan lat/lng NULL dikecualikan.
 */
export const GEOFENCE_RADIUS_M = 150;

const EARTH_RADIUS_M = 6_371_000; // radius rata-rata bumi (meter)

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Jarak great-circle antara dua titik dalam meter (formula haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True bila `point` berada dalam `radiusMeters` dari `center` (inklusif). */
export function isWithinRadius(
  center: LatLng,
  point: LatLng,
  radiusMeters: number,
): boolean {
  return haversineMeters(center, point) <= radiusMeters;
}
