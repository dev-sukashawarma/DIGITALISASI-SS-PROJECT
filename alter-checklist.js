const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:54322/postgres' }); 
async function run() { 
  await client.connect(); 
  await client.query('ALTER TABLE checklist_categories ALTER COLUMN outlet_id DROP NOT NULL;'); 
  console.log('success'); 
  process.exit(0); 
} 
run().catch(console.error);
