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
  const oldRezaId = 'bf214e57-48e6-4ecc-b4c6-0aed8ae2b79e';
  const { data: oldAtt } = await supabase
    .from('attendance')
    .select('*')
    .eq('outlet_staff_id', oldRezaId);

  console.log(`reza_leader_old attendance count: ${oldAtt?.length || 0}`);
  if (oldAtt?.length > 0) {
    console.log(JSON.stringify(oldAtt, null, 2));
  }
}

main();
