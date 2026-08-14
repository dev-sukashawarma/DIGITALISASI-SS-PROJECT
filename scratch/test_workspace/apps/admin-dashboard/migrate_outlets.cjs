require('dotenv').config({path: '.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
async function run() {
  await sql`ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS available_outlets TEXT[];`;
  console.log('Migration available_outlets done');
  process.exit(0);
}
run();
