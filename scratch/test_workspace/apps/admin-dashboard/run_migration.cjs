require('dotenv').config({path: '.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
async function run() {
  await sql`ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS tingkatan_satuan TEXT;`;
  await sql`ALTER TABLE public.bahan_baku_sku ADD COLUMN IF NOT EXISTS image_url TEXT;`;
  console.log('Migration done');
  process.exit(0);
}
run();
