const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data, error } = await supabase.rpc('get_rpc', { rpc_name: 'accessible_outlet_ids' });
  
  if (error) {
    // try direct SQL if the RPC get_rpc doesn't exist
    console.error('Error fetching RPC:', error.message);
    
    // Check role of Tri Rizky again
    const { data: tr } = await supabase.from('outlet_staff').select('role').ilike('name', '%tri rizky%');
    console.log('Tri Rizky role:', tr);
    
    // I can also just manually test if open_shift works or access works by calling the RPC directly as Tri Rizky? No, because we don't have his token. But we can check via query if the outlet is accessible.
  } else {
    console.log(data);
  }
}

main();
