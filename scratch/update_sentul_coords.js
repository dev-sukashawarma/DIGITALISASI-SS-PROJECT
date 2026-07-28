const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSentulCoordinates() {
  const sentulId = '43b7bbd1-1fd4-44b5-87ca-b07a271151af';
  const newLat = -6.562316;
  const newLng = 106.861020;

  console.log(`Updating MITRA SENTUL (${sentulId}) coordinates to lat: ${newLat}, lng: ${newLng}...`);

  const { data, error } = await supabase
    .from('outlets')
    .update({
      lat: newLat,
      lng: newLng
    })
    .eq('id', sentulId)
    .select();

  if (error) {
    console.error('Error updating MITRA SENTUL coordinates:', error);
  } else {
    console.log('✅ SUCCESS! MITRA SENTUL coordinates updated:', data);
  }
}

updateSentulCoordinates();
