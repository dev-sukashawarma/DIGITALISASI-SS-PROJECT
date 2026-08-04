const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Fetch all AMs
  const { data: ams, error: amsError } = await supabase
    .from('outlet_staff')
    .select('id, name, username, email, is_active')
    .eq('role', 'area_manager');

  if (amsError) {
    console.error('Error fetching AMs:', amsError);
    return;
  }

  // Fetch outlet assignments
  const { data: assignments, error: assignError } = await supabase
    .from('area_manager_outlets')
    .select(`
      staff_id,
      outlets (
        name
      )
    `);

  if (assignError) {
    console.error('Error fetching area_manager_outlets:', assignError.message);
    
    // Fallback: check staff_outlets if area_manager_outlets fails
    console.log('Trying staff_outlets instead...');
    const { data: staffOutlets, error: soError } = await supabase
        .from('staff_outlets')
        .select(`
          staff_id,
          outlets (
            name
          )
        `);
    if (soError) console.error(soError);
    else printAssignments(ams, staffOutlets);
  } else {
    printAssignments(ams, assignments);
  }
}

function printAssignments(ams, assignments) {
  ams.forEach(am => {
    const amOutlets = assignments
        .filter(a => a.staff_id === am.id)
        .map(a => a.outlets?.name || 'Unknown Outlet');
        
    console.log(`AM: ${am.name} (${am.email}) - Status: ${am.is_active ? 'Active' : 'Inactive'}`);
    if (amOutlets.length === 0) {
        console.log(`  -> Tidak ada outlet (Bisa jadi akses ke SEMUA outlet jika role bypass, atau belum di-assign)`);
    } else {
        console.log(`  -> Memegang ${amOutlets.length} outlet:`);
        amOutlets.forEach(o => console.log(`     - ${o}`));
    }
    console.log('');
  });
}

main();
