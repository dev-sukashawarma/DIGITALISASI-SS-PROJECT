import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

const updates = [
  { id: "550e8400-e29b-41d4-a716-446655440009", name: "PAJAJARAN", lat: -6.618890, lng: 106.815744 },
  { id: "550e8400-e29b-41d4-a716-446655440012", name: "JATIASIH", lat: -6.350826, lng: 106.935183 },
  { id: "550e8400-e29b-41d4-a716-446655440019", name: "KALISARI", lat: -6.337906, lng: 106.858212 },
  { id: "3f38c41d-11e3-49ce-a189-d7303e45f9ad", name: "CIBUBUR", lat: -6.364496, lng: 106.957356 }
];

async function run() {
  console.log('Starting remaining coordinates migration...');
  for (const outlet of updates) {
    const { error } = await admin
      .from('outlets')
      .update({ lat: outlet.lat, lng: outlet.lng })
      .eq('id', outlet.id);
      
    if (error) {
      console.error(`Error updating ${outlet.name}:`, error);
    } else {
      console.log(`Successfully updated ${outlet.name} to lat: ${outlet.lat}, lng: ${outlet.lng}`);
    }
  }
  console.log('Migration completed.');
}

run();
