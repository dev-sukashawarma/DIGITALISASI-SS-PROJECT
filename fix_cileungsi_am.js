const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Finding AM Tri Rizky...');
  
  // Find Tri Rizky
  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('id, name, role')
    .ilike('name', '%tri rizky%')
    .eq('role', 'area_manager')
    .single();
    
  if (staffError) {
    console.error('Error finding Tri Rizky:', staffError.message);
    return;
  }
  
  console.log(`Found staff: ${staff.name} (ID: ${staff.id})`);
  
  // Find Cileungsi Outlets
  const { data: outlets, error: outletsError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%cileungsi%')
    .eq('is_active', true);
    
  if (outletsError) {
    console.error('Error finding Cileungsi outlets:', outletsError.message);
    return;
  }
  
  console.log(`Found ${outlets.length} Cileungsi outlets:`);
  outlets.forEach(o => console.log(`- ${o.name} (ID: ${o.id})`));
  
  if (outlets.length === 0) {
    console.log('No active Cileungsi outlets found.');
    return;
  }
  
  // Check existing assignments
  const { data: existing, error: existingError } = await supabase
    .from('staff_outlets')
    .select('outlet_id')
    .eq('staff_id', staff.id);
    
  if (existingError) {
    console.error('Error fetching existing assignments:', existingError.message);
    return;
  }
  
  const existingIds = existing.map(e => e.outlet_id);
  
  const toInsert = outlets
    .filter(o => !existingIds.includes(o.id))
    .map(o => ({
      staff_id: staff.id,
      outlet_id: o.id
    }));
    
  if (toInsert.length === 0) {
    console.log('Tri Rizky is already assigned to all Cileungsi outlets.');
    return;
  }
  
  console.log(`Inserting ${toInsert.length} new assignments...`);
  const { error: insertError } = await supabase
    .from('staff_outlets')
    .insert(toInsert);
    
  if (insertError) {
    console.error('Error inserting assignments:', insertError.message);
    return;
  }
  
  console.log('Successfully assigned Tri Rizky to Cileungsi outlets!');
}

main();
