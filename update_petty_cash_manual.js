import fs from 'fs';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: 'apps/finance/.env.local' });

async function run() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('No DB URL found');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    // Disable triggers
    await client.query("ALTER TABLE petty_cash_topups DISABLE TRIGGER ALL;");
    console.log('Triggers disabled');

    // Update
    const res = await client.query("UPDATE petty_cash_topups SET status = 'forwarded_by_finance', area_manager_forwarded_by = NULL, area_manager_forwarded_at = NULL, leader_forwarded_by = NULL, leader_forwarded_at = NULL, completed_at = NULL, crew_received_by = NULL WHERE id = 'aacfcfac-f32b-4001-a2cb-16b67fe29531' RETURNING *");
    console.log('Update result:', res.rows[0]);

    // Enable triggers
    await client.query("ALTER TABLE petty_cash_topups ENABLE TRIGGER ALL;");
    console.log('Triggers enabled');
    
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}
run();
