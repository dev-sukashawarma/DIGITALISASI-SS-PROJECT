const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const triRizkyId = 'caf351f1-ea40-4fff-99ce-a4af71c59d47';
  
  // Ambil mapping staff_outlets untuk Tri Rizky dan join dengan tabel outlets
  const { data, error } = await supabase
    .from('staff_outlets')
    .select(`
      outlet_id,
      outlets (
        id,
        name
      )
    `)
    .eq('staff_id', triRizkyId);

  if (error) {
    console.error('Error fetching outlets:', error);
    return;
  }

  console.log('Outlets yang dipegang Tri Rizky:');
  if (data.length === 0) {
    console.log('- Tidak ada outlet yang terdaftar');
  } else {
    data.forEach(item => {
      console.log(`- ${item.outlets.name} (ID: ${item.outlet_id})`);
    });
  }
}

main();
