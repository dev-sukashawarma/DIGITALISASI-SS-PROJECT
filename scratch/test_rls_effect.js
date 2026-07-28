const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
  const dramagaId = '550e8400-e29b-41d4-a716-446655440013';
  const date = '2026-07-27';

  console.log('Testing with ANON KEY:');
  const { data: anonData, error: anonErr } = await anonClient
    .from('attendance')
    .select('id, type, status, ts_server, outlet_staff_id')
    .eq('outlet_id', dramagaId)
    .gte('ts_server', `${date}T00:00:00`)
    .lte('ts_server', `${date}T23:59:59`);

  console.log('Anon error:', anonErr);
  console.log('Anon data count:', anonData?.length);
  console.log('Anon data:', anonData);

  console.log('\nTesting with SERVICE ROLE KEY:');
  const { data: servData, error: servErr } = await serviceClient
    .from('attendance')
    .select('id, type, status, ts_server, outlet_staff_id')
    .eq('outlet_id', dramagaId)
    .gte('ts_server', `${date}T00:00:00`)
    .lte('ts_server', `${date}T23:59:59`);

  console.log('Service error:', servErr);
  console.log('Service data count:', servData?.length);
  console.log('Service data:', servData);
}

testQuery();
