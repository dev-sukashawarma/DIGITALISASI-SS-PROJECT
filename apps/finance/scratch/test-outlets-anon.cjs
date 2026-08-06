require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const client = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY);
const clientAnon = createClient('https://khpkoreaaucvyqfhynfq.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await clientAnon.from('outlets').select('id').limit(5);
  console.log('Anon outlets count:', data ? data.length : 0);
  
  // Also try to login as finance@ss.com and see if they get outlets!
  // Wait, I can just use anon for now.
}
run();
