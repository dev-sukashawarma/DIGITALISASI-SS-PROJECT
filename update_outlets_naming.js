const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Update 'SUKA SHAWARMA HQ' to 'GUDANG PUSAT (HQ)'
  const { data, error } = await supabase
    .from('outlets')
    .update({ name: 'GUDANG PUSAT (HQ)' })
    .eq('slug', 'suka-shawarma-hq')
    .select();

  if (error) {
    console.error("Failed to update warehouse:", error);
  } else {
    console.log("Successfully renamed SUKA SHAWARMA HQ to GUDANG PUSAT (HQ)");
    console.log(data);
  }
}

main();
