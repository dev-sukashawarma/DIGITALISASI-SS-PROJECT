const path = require('path');
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
  console.log('=== Starting Database Verification ===');

  // 1. Query daily_sales_targets table using select(*) to get column names
  console.log('Querying daily_sales_targets table columns...');
  const { data: targetRows, error: targetError } = await supabase
    .from('daily_sales_targets')
    .select('*')
    .limit(1);

  if (targetError) {
    console.error('Error querying daily_sales_targets:', targetError.message);
    process.exit(1);
  }

  if (targetRows && targetRows.length > 0) {
    const columns = Object.keys(targetRows[0]);
    console.log('Columns found in daily_sales_targets:', columns);
    const hasBonusAmount = columns.includes('bonus_amount');
    console.log(`Verification: bonus_amount column exists: ${hasBonusAmount ? 'PASSED ✅' : 'FAILED ❌'}`);
  } else {
    console.log('Warning: daily_sales_targets is empty, cannot query columns via select(*).');
  }

  // 2. Call the updated get_current_targets RPC
  console.log('\nCalling get_current_targets RPC...');
  const { data: targets, error: rpcError } = await supabase
    .rpc('get_current_targets');

  if (rpcError) {
    console.error('Error executing get_current_targets RPC:', rpcError.message);
    process.exit(1);
  }

  console.log('Successfully called get_current_targets!');
  console.log(`Returned ${targets.length} rows.`);

  if (targets && targets.length > 0) {
    const firstRow = targets[0];
    console.log('Sample Row:', firstRow);
    const expectedKeys = ['outlet_id', 'outlet_name', 'target_amount', 'bonus_amount', 'is_override'];
    const matches = expectedKeys.every(k => k in firstRow);
    console.log(`Verification: Row structure matches expected keys: ${matches ? 'PASSED ✅' : 'FAILED ❌'}`);
  } else {
    console.log('Warning: No outlets returned to verify row structure.');
  }

  console.log('\n=== Database Verification Completed ===');
}

run();
