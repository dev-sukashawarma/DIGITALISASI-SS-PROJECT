import { createClient } from '@supabase/supabase-js';

// Supabase Credentials
const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

// Logika Asli Geofence (dari src/lib/gps.ts)
const GEOFENCE_RADIUS_M = 100;
const MAX_GPS_ACCURACY_M = 150;
const EARTH_RADIUS_M = 6_371_000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function runTest() {
  console.log('====================================================');
  console.log('  UJI OTOMATIS GEOFENCE ABSENSI - OUTLET CICURUG    ');
  console.log('====================================================\n');

  // 1. Ambil data real dari Database Supabase
  console.log('[1/3] Mengambil data outlet real dari Supabase...');
  const { data: outlet, error } = await admin
    .from('outlets')
    .select('id, name, slug, lat, lng, is_active, open_hour, close_hour')
    .eq('slug', 'cicurug')
    .single();

  if (error || !outlet) {
    console.error('Gagal mengambil data outlet:', error);
    process.exit(1);
  }

  console.log('✅ Data Database Ditemukan:');
  console.log(`   • Nama Outlet: ${outlet.name}`);
  console.log(`   • ID Outlet:   ${outlet.id}`);
  console.log(`   • Latitude:    ${outlet.lat}`);
  console.log(`   • Longitude:   ${outlet.lng}`);
  console.log(`   • Status:      ${outlet.is_active ? 'Aktif' : 'Non-Aktif'}`);
  console.log(`   • Jam Opr:     ${outlet.open_hour} - ${outlet.close_hour}\n`);

  const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };

  // 2. Daftar Titik Pengujian Riil (Koordinat Geografis Asli)
  const testCases = [
    {
      nama: 'Skenario 1: Tepat di Depan Kasir SS Cicurug',
      userLat: -6.7851251,
      userLng: 106.7812358,
      gpsAccuracy: 5,
      ekspektasi: 'VALID'
    },
    {
      nama: 'Skenario 2: Di Seberang Jalan / Parkiran SS Cicurug',
      userLat: -6.7852500,
      userLng: 106.7812500,
      gpsAccuracy: 10,
      ekspektasi: 'VALID'
    },
    {
      nama: 'Skenario 3: Pertigaan Jl. Bangbayang (~45m)',
      userLat: -6.7855000,
      userLng: 106.7811500,
      gpsAccuracy: 15,
      ekspektasi: 'VALID'
    },
    {
      nama: 'Skenario 4: Titik Pangkas Rambut Levi (~85m)',
      userLat: -6.7848611,
      userLng: 106.7812778,
      gpsAccuracy: 10,
      ekspektasi: 'VALID'
    },
    {
      nama: 'Skenario 5: Toleransi Indoor (Jarak 110m, Akurasi GPS 20m)',
      userLat: -6.7861100,
      userLng: 106.7812358,
      gpsAccuracy: 20,
      ekspektasi: 'VALID'
    },
    {
      nama: 'Skenario 6: Diluar Radius / Depan Pasar Cicurug (~320m)',
      userLat: -6.7880000,
      userLng: 106.7810000,
      gpsAccuracy: 10,
      ekspektasi: 'DITOLAK'
    },
    {
      nama: 'Skenario 7: Akurasi GPS Sangat Buruk (Akurasi 180m > Max 150m)',
      userLat: -6.7851251,
      userLng: 106.7812358,
      gpsAccuracy: 180,
      ekspektasi: 'DITOLAK'
    }
  ];

  console.log('[2/3] Memproses Kalkulasi Jarak & Validasi Server...');
  console.log('---------------------------------------------------------------------------------------------------');
  console.log('| No | Skenario Pengujian                                | Jarak (m) | Akurasi | Adj. Dist | Status Server | Result  |');
  console.log('---------------------------------------------------------------------------------------------------');

  const results = [];

  testCases.forEach((tc, idx) => {
    const userCoords = { lat: tc.userLat, lng: tc.userLng };
    const distanceM = haversineMeters(outletCoords, userCoords);
    const accuracy = tc.gpsAccuracy;
    const adjustedDistance = Math.max(0, distanceM - accuracy);

    let status = 'VALID';
    let reason = 'Memenuhi Radius';

    if (accuracy > MAX_GPS_ACCURACY_M) {
      status = 'DITOLAK';
      reason = `Akurasi Buruk (${accuracy}m > Max ${MAX_GPS_ACCURACY_M}m)`;
    } else if (adjustedDistance > GEOFENCE_RADIUS_M) {
      status = 'DITOLAK';
      reason = `Terlalu Jauh (${Math.round(distanceM)}m > Limit ${GEOFENCE_RADIUS_M}m)`;
    }

    const isMatch = status === tc.ekspektasi;
    const passSymbol = isMatch ? '✅ PASS' : '❌ FAIL';

    console.log(
      `| ${(idx + 1).toString().padEnd(2)} | ` +
      `${tc.nama.padEnd(50)} | ` +
      `${distanceM.toFixed(1).padStart(8)}m | ` +
      `${accuracy.toString().padStart(6)}m | ` +
      `${adjustedDistance.toFixed(1).padStart(8)}m | ` +
      `${status.padEnd(13)} | ` +
      `${passSymbol}  |`
    );

    results.push({
      scenario: tc.nama,
      rawDistanceM: distanceM,
      accuracyM: accuracy,
      adjustedDistanceM: adjustedDistance,
      status,
      reason,
      pass: isMatch
    });
  });

  console.log('---------------------------------------------------------------------------------------------------\n');

  console.log('[3/3] Kesimpulan Pengujian:');
  const allPassed = results.every(r => r.pass);
  if (allPassed) {
    console.log('🎉 SEMUA SKENARIO UJI BERHASIL (100% SUKSES)!');
    console.log('   Logika geofence outlet Cicurug berfungsi sempurna dan akurat sesuai aturan 100m.');
  } else {
    console.error('⚠️ ADA SKENARIO YANG GAGAL!');
  }
}

runTest();
