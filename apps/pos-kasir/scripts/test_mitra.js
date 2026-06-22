const { createClient } = require('@supabase/supabase-js');

const ORDER_URL = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ORDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4';

const orderDb = createClient(ORDER_URL, ORDER_KEY);

async function run() {
  const { data, error } = await orderDb.from('outlets').update({ type: 'mitra' }).eq('name', 'SUKA Shawarma Cibinong');
  console.log('Result:', data, 'Error:', error);
}

run();
