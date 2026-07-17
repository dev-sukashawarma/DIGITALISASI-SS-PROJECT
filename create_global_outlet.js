const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const globalOutletId = '00000000-0000-0000-0000-000000000000';
  
  // Insert global outlet if not exists
  const { error: insertErr } = await supabase.from('outlets').upsert({
    id: globalOutletId,
    name: 'GLOBAL OUTLET (SYSTEM)',
    slug: 'global-system-outlet',
    address: 'System',
    lat: 0,
    lng: 0,
    type: 'system',
    is_active: false
  });
  
  if (insertErr) {
    console.error('Failed to insert global outlet:', insertErr);
    return;
  }
  
  console.log('Successfully created/verified global outlet');
}
main();
