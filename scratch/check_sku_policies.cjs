require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL });
  await client.connect();
  
  const policies = await client.query(`SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'bahan_baku_sku'`);
  console.log('Policies:', policies.rows);
  
  const rlsStatus = await client.query(`SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'bahan_baku_sku'`);
  console.log('RLS Status:', rlsStatus.rows);

  await client.end();
}
run().catch(console.error);
