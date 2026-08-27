const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const posUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const posKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ssOrderUrl = process.env.NEXT_PUBLIC_SS_ORDER_URL || 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ssOrderKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTMyNjcsImV4cCI6MjA5NDgyOTI2N30.X2pjS2ont0ekVVc71HLacM2I49aLeypLRRgoPQV6OTw'; // using whatever is available for test

const posClient = createClient(posUrl, posKey);
const ssOrderClient = createClient(ssOrderUrl, ssOrderKey);

async function testDatabase(client, name) {
  console.log(`\nTEST: Verifying order_type column in ${name} database...`);
  const { data, error } = await client
    .from('orders')
    .select('id, order_type')
    .limit(1);

  if (error) {
    console.error(`❌ TEST FAILED on ${name}`);
    console.error(error.message);
    return false;
  }

  console.log(`✅ TEST PASSED on ${name}`);
  return true;
}

async function runAllTests() {
  const posOk = await testDatabase(posClient, 'POS Database (khpkoreaaucvyqfhynfq)');
  const ssOk = await testDatabase(ssOrderClient, 'SS_ORDER Database (qntuhtkujpwudcpudwbj)');
  
  if (!posOk || !ssOk) {
    process.exit(1);
  }
  process.exit(0);
}

runAllTests();
