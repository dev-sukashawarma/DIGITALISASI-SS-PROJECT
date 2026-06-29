import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

const updates = [
  { id: "550e8400-e29b-41d4-a716-446655440013", name: "DRAMAGA", lat: -6.569864, lng: 106.737983 },
  { id: "550e8400-e29b-41d4-a716-446655440014", name: "CIBINONG", lat: -6.483292, lng: 106.851052 },
  { id: "550e8400-e29b-41d4-a716-446655440002", name: "EMPANG", lat: -6.607951, lng: 106.795336 },
  { id: "550e8400-e29b-41d4-a716-446655440003", name: "PALEDANG", lat: -6.596795, lng: 106.789594 },
  { id: "550e8400-e29b-41d4-a716-446655440004", name: "CIMANGGU", lat: -6.542965, lng: 106.779033 },
  { id: "550e8400-e29b-41d4-a716-446655440006", name: "JAGAKARSA", lat: -6.326894, lng: 106.817318 },
  { id: "550e8400-e29b-41d4-a716-446655440007", name: "BEJI", lat: -6.374101, lng: 106.816874 },
  { id: "550e8400-e29b-41d4-a716-446655440008", name: "SAWANGAN", lat: -6.392894, lng: 106.761781 },
  { id: "550e8400-e29b-41d4-a716-446655440005", name: "DEPOK SUKMAJAYA", lat: -6.383520, lng: 106.840955 },
  { id: "550e8400-e29b-41d4-a716-446655440010", name: "JATIWARINGIN", lat: -6.266505, lng: 106.911365 },
  { id: "550e8400-e29b-41d4-a716-446655440011", name: "CIRENDEU", lat: -6.300513, lng: 106.774531 },
  { id: "550e8400-e29b-41d4-a716-446655440016", name: "TEBET", lat: -6.236011, lng: 106.856913 },
  { id: "550e8400-e29b-41d4-a716-446655440017", name: "CISEENG", lat: -6.446457, lng: 106.686272 },
  { id: "550e8400-e29b-41d4-a716-446655440018", name: "PEKAYON", lat: -6.267008, lng: 106.971697 },
  { id: "550e8400-e29b-41d4-a716-446655440001", name: "KITCHEN (PUSAT)", lat: -6.634070, lng: 106.790099 }
];

async function run() {
  console.log('Starting coordinates migration...');
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
