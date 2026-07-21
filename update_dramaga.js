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
  const outletId = '550e8400-e29b-41d4-a716-446655440013';
  const newLat = -6.5728375;
  const newLng = 106.7448281;

  console.log(`Updating coordinates for outlet ${outletId}...`);
  
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
