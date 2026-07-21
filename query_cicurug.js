const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Querying outlets...');
  const { data: outlets, error: outletError } = await supabase
    .from('outlets')
    .select('*')
    .ilike('name', '%dramaga%');

  if (outletError) {
    console.error('Error fetching outlets:', outletError);
    return;
  }

  console.log('Outlets found:', JSON.stringify(outlets, null, 2));
}
main();
