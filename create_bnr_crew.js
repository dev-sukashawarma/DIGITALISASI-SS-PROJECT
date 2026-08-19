require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';
const supabase = createClient(url, key);

async function main() {
  const { data: outlets } = await supabase.from('outlets').select('id, name').ilike('name', '%BNR%');
  if (!outlets || outlets.length === 0) {
    console.error('BNR outlet not found');
    return;
  }
  const outletId = outlets[0].id;
  console.log('BNR Outlet ID:', outletId, outlets[0].name);

  const users = [
    { name: 'Abdul Kadir', nickname: 'abdul', role: 'crew' },
    { name: 'Roni', nickname: 'roni', role: 'crew' },
    { name: 'Gilang Gumala Putra', nickname: 'gilang', role: 'crew' },
    { name: 'Ismansyah', nickname: 'ismansyah', role: 'crew' },
    { name: 'Adam Sandy Rakhman', nickname: 'adam', role: 'crew' },
    { name: 'Fahmi', nickname: 'fahmi', role: 'crew' },
  ];

  for (const user of users) {
    const email = `${user.nickname}@ss.com`;
    const password = '123456';

    console.log(`\nProcessing user: ${user.name} (${email})...`);
    
    // Check if they exist in outlet_staff
    const { data: existingStaff } = await supabase.from('outlet_staff').select('id').eq('email', email);
    
    let userId;
    
    if (existingStaff && existingStaff.length > 0) {
      userId = existingStaff[0].id;
      console.log(`Found existing user ID in outlet_staff: ${userId}`);
    } else {
      // Create in auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { role: user.role, name: user.name }
      });
      
      if (authError) {
        console.error(`Error creating auth user for ${user.name}:`, authError.message);
        continue;
      }
      
      userId = authData.user.id;
      console.log(`Created new auth user with ID: ${userId}`);
    }

    // Update or Insert into outlet_staff
    const { error: dbError } = await supabase.from('outlet_staff').upsert({
      id: userId,
      outlet_id: outletId,
      name: user.name,
      role: user.role,
      username: user.nickname,
      email: email,
      status: 'active',
      is_active: true,
      pin: password
    });

    if (dbError) {
      console.error(`Error inserting/updating ${user.name} in outlet_staff:`, dbError.message);
    } else {
      console.log(`Successfully linked ${user.name} to outlet_staff BNR!`);
    }
    
    // Update password just to be sure
    const { error: passError } = await supabase.auth.admin.updateUserById(userId, { password: password });
    if (passError) {
       console.error(`Error updating password for ${user.name}:`, passError.message);
    } else {
       console.log(`Successfully updated password for ${user.name} to 123456.`);
    }
  }
}

main();
