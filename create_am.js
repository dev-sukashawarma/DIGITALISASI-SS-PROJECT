const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Generating link to find user ID...');
  
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'am@ss.com'
  });

  if (error) {
    console.error('Error generating link:', error);
    return;
  }

  const userId = data.user.id;
  console.log('Found User ID via generateLink:', userId);

  console.log('Updating password to test...');
  await supabase.auth.admin.updateUserById(userId, { password: 'test', email_confirm: true });
  
  console.log('Updating outlet_staff...');
  const { data: staffData, error: staffError } = await supabase
    .from('outlet_staff')
    .upsert({
      id: userId,
      name: 'Area Manager AM',
      username: 'am@ss.com',
      email: 'am@ss.com',
      role: 'area_manager',
      status: 'active',
      is_active: true,
      pin: '123456'
    })
    .select()
    .single();

  if (staffError) {
    console.error('Error updating staff:', staffError);
  } else {
    console.log('Success!', staffData);
  }
}
main();
