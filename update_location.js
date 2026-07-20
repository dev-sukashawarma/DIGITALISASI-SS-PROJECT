const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateLocation() {
  const newLat = -6.7848192;
  const newLng = 106.7812182;
  const outletId = 'd9a2ef93-c298-4501-a471-1c5e2b3dff08'; // Cicurug Outlet ID

  console.log(`Updating outlet ${outletId} with lat: ${newLat}, lng: ${newLng}`);

  const { data, error } = await supabase
    .from('outlets')
    .update({ lat: newLat, lng: newLng })
    .eq('id', outletId)
    .select();

  if (error) {
    console.error("Error updating location:", error);
  } else {
    console.log("Update successful. New data:");
    console.log(JSON.stringify(data, null, 2));
  }
}
updateLocation();
