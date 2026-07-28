const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStorageBucket() {
  const { data: files, error } = await supabase.storage.from('finance-proofs').list();
  console.log('Files in finance-proofs bucket:', files, error);

  // Try fetch single path:
  const singlePathUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co/storage/v1/object/public/finance-proofs/1785134549565_50awx.jpeg';
  const res1 = await fetch(singlePathUrl);
  console.log('Single path URL HTTP status:', res1.status, res1.statusText);
}

checkStorageBucket();
