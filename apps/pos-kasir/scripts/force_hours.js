const { createClient } = require('@supabase/supabase-js');

const POS_URL = 'https://khpkoreaaucvyqfhynfq.supabase.co';
const POS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8';

const ORDER_URL = 'https://qntuhtkujpwudcpudwbj.supabase.co';
const ORDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudHVodGt1anB3dWRjcHVkd2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI1MzI2NywiZXhwIjoyMDk0ODI5MjY3fQ.aYtkLDltwLjCoULF-i4Jgt_s3D8N5G9tHDDoEe2zju4';

const posDb = createClient(POS_URL, POS_KEY);
const orderDb = createClient(ORDER_URL, ORDER_KEY);

async function run() {
  console.log('1. Memperbaiki jam buka/tutup di database POS Kasir menjadi 13:00 - 22:00...');
  const { data: posData, error: posErr } = await posDb.from('outlets').update({ open_hour: '13:00:00', close_hour: '22:00:00' }).not('id', 'is', null);
  console.log('POS Error:', posErr);

  console.log('2. Memperbaiki jam buka/tutup di database SS_ORDER menjadi 13:00 - 22:00...');
  const { data: orderData, error: orderErr } = await orderDb.from('outlets').update({ open_hour: '13:00:00', close_hour: '22:00:00' }).not('id', 'is', null);
  console.log('SS_ORDER Error:', orderErr);
  
  console.log('✅ Selesai memperbaiki jam!');
}

run();
