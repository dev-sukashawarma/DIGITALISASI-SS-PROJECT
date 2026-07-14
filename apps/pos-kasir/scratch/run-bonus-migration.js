const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env variables. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260717000000_crew_bonus_feature.sql');
  console.log('Reading migration file from:', sqlPath);
  
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found at:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying migration to database...');
  
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error applying migration:', error.message);
    process.exit(1);
  } else {
    console.log('Migration applied successfully');
  }
}

run();
