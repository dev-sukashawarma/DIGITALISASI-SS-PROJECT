import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found');
    return;
  }
  
  const client = new Client({
    connectionString,
    ssl: false
  });

  await client.connect();

  const res = await client.query(`
    SELECT definition 
    FROM pg_views 
    WHERE viewname = 'monitoring_view_crew'
  `);
  
  console.log('View definition:');
  console.log(res.rows[0]?.definition);
  
  await client.end();
}

run();
