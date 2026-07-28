const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectSentulOutlet() {
  const { data: outlets, error } = await supabase
    .from('outlets')
    .select('id, name, lat, lng')
    .order('name');

  if (error) console.error('Error fetching outlets:', error);

  console.log('=== ALL OUTLETS IN DB ===\n');
  outlets?.forEach(o => {
    console.log(`${o.name} | lat: ${o.lat} | lng: ${o.lng} | id: ${o.id}`);
  });
}

inspectSentulOutlet();
