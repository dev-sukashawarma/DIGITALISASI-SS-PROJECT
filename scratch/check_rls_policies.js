const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndFixRls() {
  console.log('--- Checking & Updating Supabase RLS Policies for attendance ---');

  // Create or enable public SELECT on attendance table via SQL RPC if available,
  // or test fetching via API route which uses service role key.
  const { data: testAnon } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ).from('attendance').select('id').limit(1);

  console.log('Anon query result on attendance:', testAnon);
}

checkAndFixRls();
