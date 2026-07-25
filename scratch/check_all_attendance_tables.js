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
  console.log('Checking all records in `attendance` table across ALL outlets...');
  const { data: allAtt, error } = await supabase.from('attendance').select('id, outlet_id, outlet_staff_id, type, status, ts_server');
  if (error) console.error(error);
  else {
    console.log(`Total attendance records across all outlets: ${allAtt.length}`);
    console.table(allAtt);
  }
}

main();
