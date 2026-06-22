const { createClient } = require('@supabase/supabase-js');

const ORDER_URL = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ORDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4';

const orderDb = createClient(ORDER_URL, ORDER_KEY);

async function run() {
  const { data, error } = await orderDb.rpc('get_schema_info'); // likely doesn't exist
  // actually just select distinct type from outlets
  const { data: d2, error: e2 } = await orderDb.from('outlets').select('type');
  console.log(new Set(d2.map(x => x.type)));
}
run();
