const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setup() {
  const outletId = 'b05bc294-4873-401c-9450-8d9b0dc17ec0';
  const amId = '4f1d7a91-7ef8-49b1-977f-7074ca48ed6c';
  
  const leaderEmail = 'tes2.leader@ss.com';
  const password = '123456';
  const leaderName = 'Leader Tes2';

  // 1. Create Auth user for Leader
  console.log('Generating link to find or create user ID for leader...');
  let { data: authData, error: authError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: leaderEmail
  });

  if (authError) {
    console.error('Error generating link for leader:', authError);
    return;
  }
  
  const leaderUserId = authData.user.id;
  console.log('Found/Created Leader Auth User ID:', leaderUserId);

  console.log('Updating password for leader...');
  await supabase.auth.admin.updateUserById(leaderUserId, { password: password, email_confirm: true });

  // 2. Create in outlet_staff
  console.log('Updating outlet_staff for leader...');
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .upsert({
      id: leaderUserId,
      name: leaderName,
      username: leaderEmail,
      email: leaderEmail,
      role: 'leader',
      status: 'active',
      is_active: true,
      pin: password
    })
    .select()
    .single();

  if (staffError) {
    console.error('Error updating staff:', staffError);
  } else {
    console.log('Leader staff created successfully.');
  }

  // 3. Assign Leader to outlet in staff_outlets
  console.log('Assigning Leader to outlet tes2...');
  const { error: soError } = await supabase
    .from('staff_outlets')
    .upsert({
      staff_id: leaderUserId,
      outlet_id: outletId
    });

  if (soError) {
    console.error('Error assigning leader to outlet:', soError);
  } else {
    console.log('Leader successfully assigned to tes2.');
  }

  // 4. Assign AM to outlet tes2 in area_manager_outlets
  console.log('Assigning AM to outlet tes2 in area_manager_outlets...');
  const { error: amoError } = await supabase
    .from('area_manager_outlets')
    .upsert({
      staff_id: amId,
      outlet_id: outletId
    });

  if (amoError) {
    console.error('Error assigning AM to outlet in area_manager_outlets:', amoError);
    console.log('Attempting to assign in staff_outlets instead for AM...');
    await supabase.from('staff_outlets').upsert({
      staff_id: amId,
      outlet_id: outletId
    });
  } else {
    console.log('AM successfully assigned to tes2.');
  }

  console.log('Done!');
}

setup().catch(console.error);
