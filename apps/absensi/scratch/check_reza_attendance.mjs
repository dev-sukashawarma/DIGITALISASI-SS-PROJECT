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

async function checkReza() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const rezaId = '6b41b068-0feb-47d3-aea8-bae94f75fc09';

  console.log('=== 1. CICURUG OUTLET COORDINATES IN DB ===');
  const { data: outlet } = await admin.from('outlets').select('id, name, lat, lng, address').eq('id', cicurugId).single();
  console.log('Outlet:', outlet);

  console.log('\n=== 2. ALL ATTENDANCE RECORDS & BLOCKS FOR REZA ===');
  const { data: attendance } = await admin
    .from('attendance')
    .select('*')
    .eq('outlet_staff_id', rezaId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(JSON.stringify(attendance, null, 2));

  if (attendance && attendance.length > 0) {
    for (const r of attendance) {
      if (r.gps_lat && r.gps_lng && outlet.lat && outlet.lng) {
        const dist = haversineMeters({ lat: Number(outlet.lat), lng: Number(outlet.lng) }, { lat: Number(r.gps_lat), lng: Number(r.gps_lng) });
        console.log(`\nRecord [${r.id}]:`);
        console.log(`  Type: ${r.type}, Status: ${r.status}`);
        console.log(`  Recorded User Coords: Lat ${r.gps_lat}, Lng ${r.gps_lng}`);
        console.log(`  Calculated Haversine Distance: ${dist.toFixed(2)} meters`);
      }
    }
  }
}

checkReza();
