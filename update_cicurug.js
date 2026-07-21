const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

// Fallback to other env file
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
  const outletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08';
  const newLat = -6.784847;
  const newLng = 106.781277;

  console.log(`Updating coordinates for Cicurug outlet ${outletId}...`);
  
  const { data, error } = await supabase
    .from('outlets')
    .update({ lat: newLat, lng: newLng })
    .eq('id', outletId)
    .select();

  if (error) {
    console.error('Error updating outlet:', error);
  } else {
    console.log('Update success!', data);
  }
}

main();
