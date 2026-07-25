const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const cicurugId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';

  console.log('=== 1. OUTLETS TABLE DATA ===');
  const { data: outlet } = await supabase.from('outlets').select('*').eq('id', cicurugId).single();
  console.log(outlet);

  console.log('\n=== 2. OUTLET ATTENDANCE CONFIG ===');
  const { data: config } = await supabase.from('outlet_attendance_config').select('*').eq('outlet_id', cicurugId);
  console.log(config);

  console.log('\n=== 3. ALL ATTENDANCE CONFIGS ===');
  const { data: allConfigs } = await supabase.from('outlet_attendance_config').select('*');
  console.log(allConfigs);

  console.log('\n=== 4. AUDIT LOGS OR RECENT UPDATES TO OUTLETS ===');
  // Check if there are other outlets or history
  const { data: allOutlets } = await supabase.from('outlets').select('id, name, slug, lat, lng, updated_at');
  console.log(allOutlets);
}

main();
