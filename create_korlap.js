const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Creating Korlap user...');

  // 1. Create User in auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'korlap@sukashawarma.com',
    password: 'password123',
    email_confirm: true,
  });

  if (authError) {
    console.log('User already exists in auth.users. Using known ID...');
    const knownId = '6348472b-6d7d-43fd-ace4-084d25daf6e5';
    await createOutletStaff(knownId);
    return;
  }

  const userId = authData.user.id;
  console.log('User created with ID:', userId);

  await createOutletStaff(userId);
}

async function createOutletStaff(userId) {
    // 2. Insert into public.outlet_staff
    const { data: staffData, error: staffError } = await supabase
      .from('outlet_staff')
      .upsert({
        id: userId,
        name: 'Korlap Pusat',
        role: 'korlap',
        status: 'active'
      })
      .select()
      .single();
  
    if (staffError) {
      console.error('Error inserting outlet_staff:', staffError);
      return;
    }
  
    console.log('Korlap outlet_staff created successfully:', staffData);
    
    // No need to insert into staff_outlets because korlap gets global non-Bogor access
    console.log('Done! Login credentials: korlap@sukashawarma.com / password123');
}

main();
