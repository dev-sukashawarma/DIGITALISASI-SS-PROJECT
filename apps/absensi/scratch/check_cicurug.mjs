import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const admin = createClient(supabaseUrl, serviceKey);

async function check() {
  console.log('=== ALL OUTLETS ===');
  const { data: outlets, error: errOutlets } = await admin
    .from('outlets')
    .select('*');
    
  if (errOutlets) {
    console.error('Error fetching outlets:', errOutlets);
    return;
  }
  
  console.log('Total outlets:', outlets.length);
  for (const o of outlets) {
    console.log(`- [${o.id}] ${o.name}: lat=${o.lat}, lng=${o.lng}, radius=${o.radius_meters || o.radius || 'N/A'}`);
  }

  const cicurug = outlets.find(o => o.name.toLowerCase().includes('cicurug'));
  if (!cicurug) {
    console.log('\nNO OUTLET FOUND matching "cicurug"!');
  } else {
    console.log('\n=== CICURUG OUTLET ===', cicurug);
    
    // Check staff in Cicurug
    const { data: staff, error: errStaff } = await admin
      .from('outlet_staff')
      .select('*')
      .eq('outlet_id', cicurug.id);
      
    console.log('\n=== STAFF IN CICURUG ===', errStaff ? errStaff : staff);
  }
}

check();
