const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../apps/admin-dashboard/.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function makeMitraBucketPublic() {
  const { data, error } = await supabase.storage.updateBucket('mitra-transfers', {
    public: true
  });
  console.log('Update mitra-transfers bucket result:', data, error);
}

makeMitraBucketPublic();
