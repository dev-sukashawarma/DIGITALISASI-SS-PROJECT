const { createClient } = require('@supabase/supabase-js');
const url = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(url, key);

async function main() {
  const { data: outlets, error } = await supabase.from('outlets').select('id, name').limit(1);
  if (error) {
    console.error('Error fetching outlets:', error);
    return;
  }
  console.log('Outlets:', outlets);

  if (outlets.length > 0) {
    const outletId = outlets[0].id;
    
    // Check if user exists first by trying to create, if error we'll see
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: 'spv@test.com',
      password: 'password123',
      email_confirm: true,
    });
    
    console.log('Create User Result:', userError ? userError.message : user.user.id);
    
    // Find or create in outlet_staff
    const { data: existingStaff } = await supabase.from('outlet_staff').select('*').eq('email', 'spv@test.com');
    if (!existingStaff || existingStaff.length === 0) {
      console.log('Creating outlet_staff...');
      const { data: insertData, error: insertError } = await supabase.from('outlet_staff').insert([
        {
          email: 'spv@test.com',
          name: 'SPV Test',
          role: 'spv',
          outlet_id: outletId
        }
      ]);
      console.log('Insert Result:', insertError || 'Success');
    } else {
      console.log('SPV already exists in outlet_staff:', existingStaff[0]);
    }
  }
}
main();
