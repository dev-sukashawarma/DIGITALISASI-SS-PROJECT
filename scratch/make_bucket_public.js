const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function makeBucketPublic() {
  const { data, error } = await supabase.storage.updateBucket('finance-proofs', {
    public: true
  });

  console.log('Update bucket result:', data, error);

  // Test public fetch again
  const testUrl = 'https://khpkoreaaucvyqfhynfq.supabase.co/storage/v1/object/public/finance-proofs/finance-proofs/1785134549565_50awx.jpeg';
  const res = await fetch(testUrl);
  console.log('Public fetch status after making bucket public:', res.status, res.statusText);
}

makeBucketPublic();
