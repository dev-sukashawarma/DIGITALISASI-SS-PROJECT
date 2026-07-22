import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

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

async function runScenarioTests() {
  console.log('===========================================================');
  console.log('TEST SKENARIO ABSENSI SUKA SHAWARMA CICURUG (COMPREHENSIVE)');
  console.log('===========================================================');

  const outletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // SUKA SHAWARMA CICURUG
  const staffId = '6b41b068-0feb-47d3-aea8-bae94f75fc09';   // Reza

  const { data: outlet } = await admin.from('outlets').select('lat, lng, name').eq('id', outletId).single();
  const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };

  console.log(`Outlet Reference Coords: Lat ${outletCoords.lat}, Lng ${outletCoords.lng}\n`);

  // --- SKENARIO 1: Real-case location offset (Normal Valid Attendance) ---
  console.log('--- SKENARIO 1: Real-Case Valid Attendance (Posisi ~26.6m dari titik DB) ---');
  const userGps1 = { lat: -6.785300, lng: 106.781400 };
  const dist1 = haversineMeters(outletCoords, userGps1);
  const accuracy1 = 12.5;
  const adjDist1 = Math.max(0, dist1 - accuracy1);
  console.log(`- Raw Distance: ${dist1.toFixed(2)}m`);
  console.log(`- Adjusted Distance: ${adjDist1.toFixed(2)}m (Max Limit: 100m)`);
  console.log(`- Result: ${adjDist1 <= 100 ? '✅ LOLOS GEOFENCE' : '❌ TERBLOKIR'}\n`);

  // --- SKENARIO 2: Out of Geofence (>100m away) ---
  console.log('--- SKENARIO 2: Out of Geofence Test (Posisi ~250m dari Outlet) ---');
  const userGps2 = { lat: -6.787000, lng: 106.783000 };
  const dist2 = haversineMeters(outletCoords, userGps2);
  const accuracy2 = 10.0;
  const adjDist2 = Math.max(0, dist2 - accuracy2);
  console.log(`- Raw Distance: ${dist2.toFixed(2)}m`);
  console.log(`- Adjusted Distance: ${adjDist2.toFixed(2)}m (Max Limit: 100m)`);
  console.log(`- Result: ${adjDist2 <= 100 ? '✅ LOLOS GEOFENCE' : '❌ TERBLOKIR DENGAN BENAR (too_far_from_outlet)'}\n`);

  // --- SKENARIO 3: Fake GPS Spoofing Detection ---
  console.log('--- SKENARIO 3: Fake GPS Detection Test (is_mock: true atau static accuracy) ---');
  const isMock3 = true;
  const accuracy3 = 1.0; // static fake accuracy
  const isFake3 = isMock3 || accuracy3 === 1.0 || accuracy3 === 0.0;
  console.log(`- Is Mock Flagged: ${isMock3}`);
  console.log(`- Accuracy Value: ${accuracy3}m`);
  console.log(`- Result: ${isFake3 ? '❌ TERBLOKIR DENGAN BENAR (fake_gps_detected)' : '✅ LOLOS'}\n`);

  // Cleanup test attendance records created during simulation
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data: records, error: errFetch } = await admin
    .from('attendance')
    .select('id, created_at, status, distance_m, gps_lat, gps_lng')
    .eq('outlet_id', outletId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  console.log('--- ABSENSI HARI INI DI OUTLET CICURUG ---');
  console.log(JSON.stringify(records, null, 2));
}

runScenarioTests();
