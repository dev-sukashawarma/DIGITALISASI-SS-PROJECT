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

async function simulateCicurugAttendance() {
  console.log('====================================================');
  console.log('SIMULASI ABSENSI AT OUTLET CICURUG (REAL CASE TEST)');
  console.log('====================================================');

  const outletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // SUKA SHAWARMA CICURUG
  const staffId = '6b41b068-0feb-47d3-aea8-bae94f75fc09';   // Reza (Staff Cicurug)

  // 1. Fetch Outlet Data
  const { data: outlet, error: errOutlet } = await admin
    .from('outlets')
    .select('id, name, lat, lng')
    .eq('id', outletId)
    .single();

  if (errOutlet || !outlet) {
    console.error('FAILED: Outlet not found', errOutlet);
    return;
  }

  console.log(`\n[1] Outlet Database Info:`);
  console.log(`    Nama: ${outlet.name}`);
  console.log(`    DB Coords: Lat ${outlet.lat}, Lng ${outlet.lng}`);

  // 2. Fetch Staff Data
  const { data: staff, error: errStaff } = await admin
    .from('outlet_staff')
    .select('id, name, outlet_id, face_descriptor')
    .eq('id', staffId)
    .single();

  if (errStaff || !staff) {
    console.error('FAILED: Staff not found', errStaff);
    return;
  }

  console.log(`\n[2] Staff Info:`);
  console.log(`    Nama: ${staff.name}`);
  console.log(`    Enrolled Face: ${staff.face_descriptor ? 'YES' : 'NO'}`);

  // 3. User Simulated Real-Case Location
  // Realistic location offset: ~26.6 meters away from database reference point
  const userGps = { lat: -6.785300, lng: 106.781400 };
  const userGpsAccuracy = 12.5; // meter
  const isMock = false;

  console.log(`\n[3] Simulated User GPS (Real-case offset):`);
  console.log(`    User Coords: Lat ${userGps.lat}, Lng ${userGps.lng}`);
  console.log(`    User Accuracy: ${userGpsAccuracy}m`);
  console.log(`    Is Mock Location: ${isMock}`);

  // 4. Calculate Distance & Geofence
  const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };
  const distanceM = haversineMeters(outletCoords, userGps);
  const adjustedDistance = Math.max(0, distanceM - userGpsAccuracy);
  const GEOFENCE_RADIUS_M = 100;

  console.log(`\n[4] Geofence Validation:`);
  console.log(`    Raw Distance to Outlet: ${distanceM.toFixed(2)} meters`);
  console.log(`    Adjusted Distance (minus accuracy): ${adjustedDistance.toFixed(2)} meters`);
  console.log(`    Geofence Threshold: ${GEOFENCE_RADIUS_M} meters`);

  if (adjustedDistance > GEOFENCE_RADIUS_M) {
    console.log(`    ❌ GEOFENCE BLOCKED: Too far from outlet`);
    return;
  }
  console.log(`    ✅ GEOFENCE PASSED! User is within outlet area.`);

  // 5. Config & Time Window Check
  const tsServer = new Date().toISOString();
  const local = new Date(new Date(tsServer).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const jamMasuk = "13:00"; // Global config
  const toleransi = 15;

  const [h, m] = jamMasuk.split(":").map(Number);
  const deadline = new Date(local);
  deadline.setHours(h, m, 0, 0);

  const toleransiDeadline = new Date(local);
  toleransiDeadline.setHours(h, m + toleransi, 0, 0);

  let status = "tepat";
  let telat_menit = null;

  if (local.getTime() <= toleransiDeadline.getTime()) {
    status = "tepat";
  } else {
    status = "telat";
    telat_menit = Math.floor((local.getTime() - deadline.getTime()) / 60000);
  }

  console.log(`\n[5] Time & Status Check:`);
  console.log(`    Server Time (WIB): ${local.toLocaleTimeString("id-ID")}`);
  console.log(`    Shift Jam Masuk: ${jamMasuk} (Toleransi ${toleransi} min)`);
  console.log(`    Calculated Status: "${status}" (telat_menit: ${telat_menit})`);

  // 6. Submit Attendance Record to Database
  const attendanceId = crypto.randomUUID();
  const selfiePath = `${outletId}/${staffId}_test.jpg`;

  console.log(`\n[6] Submitting Attendance Record...`);
  const { data: record, error: errInsert } = await admin
    .from('attendance')
    .upsert({
      id: attendanceId,
      outlet_staff_id: staffId,
      outlet_id: outletId,
      type: 'in',
      ts_server: tsServer,
      ts_client: tsServer,
      gps_lat: userGps.lat,
      gps_lng: userGps.lng,
      distance_m: distanceM,
      match_distance: 0.31,
      selfie_url: selfiePath,
      status: status,
      telat_menit: telat_menit,
    }, { onConflict: 'id' })
    .select();

  if (errInsert) {
    console.error('❌ Insert failed:', errInsert);
  } else {
    console.log('✅ SUCCESS! Absen Masuk Cicurug BERHASIL dicatat ke Database:');
    console.log(JSON.stringify(record, null, 2));
  }
}

simulateCicurugAttendance();
