require('dotenv').config({path: '.env.local'});
const postgres = require('postgres');
const fs = require('fs');

async function run() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    console.error('Missing DB URL');
    process.exit(1);
  }
  const sql = postgres(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
  try {
    console.log('Running add_channel_prices.sql...');
    const result = await sql.file('add_channel_prices.sql');
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
