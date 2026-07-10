const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

// Fallback to other env file if admin-dashboard env doesn't exist
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    require('dotenv').config({ path: '.env.local' });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data: outlets, error } = await supabase.from('outlets').select('id, name, slug').order('name');
  if (error) {
      console.error("Error fetching outlets:", error);
      return;
  }
  console.log(`Total Outlets: ${outlets.length}`);
  console.table(outlets);
}
main();
