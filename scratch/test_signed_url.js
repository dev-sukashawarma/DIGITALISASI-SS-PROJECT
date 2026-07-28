const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSignedUrl() {
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets);

  const { data: signedData, error: signedErr } = await supabase.storage
    .from('finance-proofs')
    .createSignedUrl('finance-proofs/1785134549565_50awx.jpeg', 3600);

  console.log('Signed URL result:', signedData, signedErr);

  if (signedData?.signedUrl) {
    const res = await fetch(signedData.signedUrl);
    console.log('Signed URL fetch status:', res.status, res.statusText, 'Content-Length:', res.headers.get('content-length'));
  }
}

testSignedUrl();
