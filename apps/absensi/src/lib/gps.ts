/**
 * Geolokasi untuk validasi radius absensi (M1).
 *
 * Catatan: nilai dari client dipakai untuk UX/preview saja. Keputusan
 * "absen sah/tidak" difinalkan server (Edge Function submit-attendance)
 * yang menghitung ulang jarak dari outlets.lat/lng — lihat spec M1 §5.
 */

export type LatLng = { lat: number; lng: number };

/**
 * Radius geofence absensi (meter) - sumber tunggal client & server.
 *
 * Diperketat ke 100 m setelah koordinat outlet dikalibrasi akurat lewat halaman
 * peta SPV (/dashboard/pengaturan-lokasi). GPS drift indoor dikompensasi
 * toleransi akurasi inline (max(0, jarak - akurasi) <= radius) + penolakan
 * akurasi buruk (MAX_GPS_ACCURACY_M). Outlet dengan lat/lng NULL dikecualikan.
 */
export const GEOFENCE_RADIUS_M = 100;

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

/**
 * Akurasi GPS terburuk (meter) yang masih boleh absen. Di atas ini, toleransi
 * akurasi akan "menelan" geofence 30 m → tolak & minta aktifkan Lokasi Akurat.
 */
export const MAX_GPS_ACCURACY_M = 150;

/** True bila akurasi GPS (meter) cukup baik untuk dipercaya absen. */
export function isGpsAccuracyAcceptable(accuracyM: number): boolean {
  return accuracyM <= MAX_GPS_ACCURACY_M;
}

/** 
 * Format jarak agar lebih mudah dibaca (ubah meter jadi kilometer jika >= 1000).
 */
export function formatDistanceMeters(meters: number, shortForm: boolean = false): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    // Hapus desimal .0 jika bulat, tapi tetap toFixed(1)
    return `${km.toFixed(1).replace(/\.0$/, '')}${shortForm ? 'km' : ' kilometer'}`;
  }
  return `${meters.toFixed(1).replace(/\.0$/, '')}${shortForm ? 'm' : ' meter'}`;
}

/**
 * Parameter & Helper Deteksi Sinyal Meta Fake GPS (Mock Location Provider)
 */
export interface GpsMetaSignal {
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  isMock?: boolean;
}

export interface AntiFakeGpsResult {
  isFakeGps: boolean;
  reason?: string;
}

/**
 * Analisis pola sinyal meta lokasi untuk mendeteksi penggunaan Fake GPS.
 * Aplikasi Fake GPS umumnya menyuplai nilai akurasi statis yang tidak wajar (1.0m/0.0m).
 */
export function detectFakeGpsSignals(meta: GpsMetaSignal): AntiFakeGpsResult {
  if (meta.isMock === true) {
    return { isFakeGps: true, reason: "mock_provider_flagged" };
  }
  
  if (meta.accuracy !== undefined && meta.accuracy !== null) {
    if (meta.accuracy === 1.0 || meta.accuracy === 0.0) {
      return { isFakeGps: true, reason: "static_fake_accuracy" };
    }
  }

  return { isFakeGps: false };
}

/**
 * Hitung kecepatan perpindahan antar dua koordinat (km/jam).
 * Digunakan untuk mendeteksi teleportasi lokasi yang tidak wajar.
 */
export function calculateSpeedKmH(
  prevCoords: LatLng,
  prevTimestampMs: number,
  currCoords: LatLng,
  currTimestampMs: number
): number {
  const timeDiffHours = (currTimestampMs - prevTimestampMs) / (1000 * 60 * 60);
  if (timeDiffHours <= 0) return 0;
  
  const distMeters = haversineMeters(prevCoords, currCoords);
  const distKm = distMeters / 1000;
  
  return distKm / timeDiffHours;
}

/** Max kecepatan perjalanan wajar (km/jam). Di atas ini dianggap teleportasi/fake GPS */
export const MAX_REASONABLE_SPEED_KMH = 160;

