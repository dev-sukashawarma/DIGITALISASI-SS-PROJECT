require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('query_sql', { query: "SELECT tgname FROM pg_trigger WHERE tgname = 'assign_order_number';" });
  if (error) {
    console.error("Error with rpc:", error.message);
    // fallback to generic postgrest query? No, just try to read from pg_trigger if accessible via REST? Not usually.
  } else {
    console.log("Trigger:", data);
  }
}

run();
