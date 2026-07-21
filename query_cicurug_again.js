const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/absensi/.env.local' });

// Fallback to other env file
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%cicurug%');

  if (outletError) {
    console.error('Error fetching outlets:', outletError);
    return;
  }

  console.log('Outlets found:', JSON.stringify(outlets, null, 2));
}
main();
