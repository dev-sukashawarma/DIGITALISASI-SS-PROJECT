const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env.local' });
// We cannot do raw SQL via supabase-js without an RPC.
// Let me write a script that tries all possible category variations to see if ANY works.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const cats = ['item core', 'core item', 'item_core', 'core_item', 'Item Core', 'Core Item', 'kemasan', 'saus'];
  for (const c of cats) {
     const { error } = await supabase.from('bahan_baku').insert({
        id: 'dc89a94f-736f-4feb-b792-b5e5446cc9f' + Math.floor(Math.random()*16).toString(16),
        nama: 'TEST KATEGORI ' + c,
        satuan: 'kg',
        kategori: c,
        is_active: false
      });
      console.log(`Result for ${c}:`, error ? error.message : 'Success');
  }
}
run();
