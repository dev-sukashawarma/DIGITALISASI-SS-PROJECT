require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminClient = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: { users } } = await adminClient.auth.admin.listUsers();
  const user = users.find(u => u.email === 'finance@sukashawarma.com' || u.email === 'admin@sukashawarma.com' || u.role === 'authenticated');
  if (!user) return console.log('no user');

  console.log('Testing with user:', user.email, user.id);
  
  // We can simulate an RLS check using Postgres function directly or just log in via adminClient.auth.admin.generateLink
  // Let's just create a test JWT using jsonwebtoken
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      sub: user.id,
      email: user.email,
      role: 'authenticated'
    },
    'Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8', // No, we don't have the JWT secret.
    {}
  );
}
test();
