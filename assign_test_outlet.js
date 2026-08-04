const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // 1. Get staff ID
  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('id')
    .eq('email', 'am@ss.com')
    .single();

  if (staffError) {
    console.error('Error finding staff:', staffError);
    return;
  }
  
  const staffId = staff.id;
  console.log('Staff ID:', staffId);

  // 2. Get Outlet Test
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%tes%');

  if (outletError) {
    console.error('Error finding outlet:', outletError);
    return;
  }

  if (outlets.length === 0) {
    console.log('No outlet found matching "%tes%"');
    return;
  }

  console.log('Found outlets matching "tes":', outlets);
  const outletId = outlets[0].id; // assuming the first one is the intended test outlet

  // 3. Assign
  const { data: assign, error: assignError } = await supabase
    .from('staff_outlets')
    .upsert({
      staff_id: staffId,
      outlet_id: outletId
    })
    .select();

  if (assignError) {
    console.error('Error assigning outlet:', assignError);
  } else {
    console.log('Successfully assigned outlet to am@ss.com!', assign);
  }
}

main();
