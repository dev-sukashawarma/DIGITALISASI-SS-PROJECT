require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, key);

  const userId = '329ea998-9bfd-4cf2-8cdd-7ccaa9f5f267';
  console.log('Using known User ID:', userId);
  
  console.log('Updating password to ownerss...');
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { 
    password: 'ownerss', 
    user_metadata: { role: 'owner', name: 'Owner' } 
  });
  if (updateError) console.error('Error updating password:', updateError);
  else console.log('Successfully updated password.');

  console.log('Inserting into outlet_staff...');
  const { error: dbError } = await supabase.from('outlet_staff').upsert({
    id: userId,
    name: 'Owner',
    role: 'owner',
    username: 'ownerss',
    status: 'active',
    email: 'owner@ss.com'
  });
  
  if (dbError) {
    console.error('Error upserting to outlet_staff:', dbError);
  } else {
    console.log('Successfully created owner account and linked to outlet_staff!');
  }
}

main();
