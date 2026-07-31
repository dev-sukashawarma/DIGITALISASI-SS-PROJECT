const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/admin-dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImage() {
  const path = '550e8400-e29b-41d4-a716-446655440002/5df6a5e9-0675-44f1-a344-6e93ea38170c.jpg';
  
  // create signed URL since it seems the bucket is private or requires signed urls
  const { data, error } = await supabase.storage.from('face-refs').createSignedUrl(path, 3600);
  
  if (error) {
    console.error('Error creating signed url:', error);
  } else {
    console.log('Signed URL:', data.signedUrl);
  }
}

checkImage();
