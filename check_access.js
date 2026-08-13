const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const staffId = 'caf351f1-ea40-4fff-99ce-a4af71c59d47';
  console.log(`Checking accessible_outlet_ids logic for ${staffId}...`);

  // Simulate the accessible_outlet_ids logic:
  // 1. Get role and outlet_id from outlet_staff
  const { data: me } = await supabase.from('outlet_staff').select('role, outlet_id').eq('id', staffId).single();
  console.log('Me:', me);

  let accessibleIds = [];

  if (['admin', 'admin_hr', 'owner', 'spv', 'regional_manager', 'kitchen', 'admin_finance'].includes(me.role)) {
    const { data: all } = await supabase.from('outlets').select('id');
    accessibleIds.push(...all.map(o => o.id));
  } 
  
  if (['leader', 'korlap', 'area_manager'].includes(me.role)) {
    const { data: so } = await supabase.from('staff_outlets').select('outlet_id').eq('staff_id', staffId);
    if (so) accessibleIds.push(...so.map(s => s.outlet_id));
  } 
  
  if (['crew', 'kiosk', 'mitra', 'staff_pusat'].includes(me.role)) {
    if (me.outlet_id) accessibleIds.push(me.outlet_id);
  }

  // Remove duplicates
  accessibleIds = [...new Set(accessibleIds)];
  
  console.log(`Simulated accessible IDs count: ${accessibleIds.length}`);
  if (accessibleIds.length > 0) {
    const { data: out } = await supabase.from('outlets').select('name').in('id', accessibleIds);
    console.log('Outlets:', out.map(o => o.name));
  }
}

main();
