const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const outletId = "eb174b2b-ff69-47eb-97af-b6c824d3ce4a"; // outlet tes

console.log('Menghubungkan ke Realtime Supabase...');

const channel = supabase.channel(`test-realtime-${outletId}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
    (payload) => {
      console.log('Realtime event diterima (orders):', payload.eventType, payload.new?.id || payload.old?.id);
    }
  )
  .subscribe((status) => {
    console.log('Status langganan:', status);
    
    if (status === 'SUBSCRIBED') {
      console.log('Berhasil berlangganan. Memicu perubahan...');
      // Trigger a change to see if we get the event
      supabase.from('orders').update({ updated_at: new Date().toISOString() })
        .eq('customer_name', 'Antigravity Test')
        .then(({ error }) => {
          if (error) console.error('Gagal update:', error);
          else console.log('Update terpicu, menunggu event...');
        });
    }
  });

setTimeout(() => {
  console.log('Selesai menunggu.');
  process.exit(0);
}, 10000);
