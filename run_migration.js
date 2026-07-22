const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260722110000_update_petty_cash_flow_and_bank.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function main() {
  // Connection string from local or remote
  const connStr = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  const client = new Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log('Connected to Postgres, applying migration...');
    await client.query(sql);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

main();
