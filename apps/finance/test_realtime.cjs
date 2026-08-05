require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log('Connecting to Realtime...');
  const channel = supabase.channel('test-channel');
  
  channel.on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'petty_cash_topups'
  }, (payload) => {
    console.log('RECEIVED EVENT:', payload);
  }).subscribe(async (status) => {
    console.log('Subscription status:', status);
    
    if (status === 'SUBSCRIBED') {
      console.log('Triggering an update...');
      const { data } = await supabase.from('petty_cash_topups').select('id, status').limit(1);
      if (data && data.length > 0) {
        const row = data[0];
        console.log('Updating row', row.id);
        const { error } = await supabase.from('petty_cash_topups').update({ description: 'test update ' + Date.now() }).eq('id', row.id);
        if (error) console.error('Update error:', error);
      }
    }
  });

  setTimeout(() => {
    console.log('Test timeout');
    process.exit(0);
  }, 5000);
}

test();
