require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const email = 'owner@sukashawarma.com';
  
  // Find user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error fetching users:", listError);
    return;
  }
  
  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User with email ${email} not found.`);
    return;
  }
  
  console.log(`Found user ID: ${user.id}`);
  
  // Update password
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: 'test'
  });
  
  if (error) {
    console.error("Error updating password:", error);
  } else {
    console.log(`Successfully updated password for ${email} to 'test'`);
  }
}

main();
