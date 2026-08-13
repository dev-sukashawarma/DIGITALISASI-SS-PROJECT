const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const staffId = 'f5ea93b3-59b3-4de1-9d14-4f52f7dec0ba'; // REJA
  const outletId = '62a56103-2085-4dd5-9d25-a3c0cffc88ff'; // MITRA CILEUNGSI

  const { data, error } = await supabase
    .from('staff_outlets')
    .insert([{ staff_id: staffId, outlet_id: outletId }])
    .select();

  if (error) {
    console.error('Error assigning outlet:', error.message);
  } else {
    console.log('Successfully assigned Cileungsi to Reja:', data);
  }
}

main();
