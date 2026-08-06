require('dotenv').config({path: '.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
async function run() {
  await sql`ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'developer';`;
  console.log('Migration developer role done');
  process.exit(0);
}
run().catch(console.error);
