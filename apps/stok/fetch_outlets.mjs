import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: outlets, error } = await supabase.from('outlets').select('*').limit(5);
  if (error) {
    console.error("Error fetching outlets:", error.message);
  } else {
    console.log("Outlets:", outlets);
  }
}

main();
