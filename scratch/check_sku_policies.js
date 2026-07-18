require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

async function run() {
  const policies = await sql`SELECT * FROM pg_policies WHERE tablename = 'bahan_baku_sku'`;
  console.log('Policies:', policies);
  
  const rlsStatus = await sql`SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'bahan_baku_sku'`;
  console.log('RLS Status:', rlsStatus);

  process.exit(0);
}
run();
