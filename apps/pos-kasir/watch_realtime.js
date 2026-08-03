const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const outletId = "eb174b2b-ff69-47eb-97af-b6c824d3ce4a"; // outlet tes

console.log('Menghubungkan ke Realtime Supabase untuk mengamati KasirOrderClient logic...');

let debounceTimer = null;
const triggerInvalidate = (source) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  console.log(`[${new Date().toISOString()}] triggerInvalidate terpanggil karena event dari: ${source}`);
  debounceTimer = setTimeout(async () => {
    console.log(`[${new Date().toISOString()}] invalidateQueries dieksekusi (setelah debounce 300ms) - Refetching fetchTodayOrders...`);
    
    // Simulate what fetchTodayOrders does:
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*, menu_items(id,name))')
          .eq('outlet_id', outletId)
          .or(`created_at.gte.${today.toISOString()},status.in.(pending,preparing)`)
          .order('created_at', { ascending: false })
          .limit(1); // just get the latest

    if (error) {
      console.error('Fetch error:', error);
    } else {
      if (data && data.length > 0) {
        const order = data[0];
        console.log(`Fetch result => Order ID: ${order.id}, Status: ${order.status}, Total Items: ${order.order_items ? order.order_items.length : 0}`);
      } else {
        console.log('Fetch result => No orders found for today?');
      }
    }
  }, 300);
};

const channelName = `kasir-orders-realtime-${outletId}`;
const channel = supabase.channel(channelName)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'orders', filter: `outlet_id=eq.${outletId}` },
    (payload) => {
      console.log(`\n[${new Date().toISOString()}] EVENT orders: ${payload.eventType}`);
      triggerInvalidate('orders');
    }
  )
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'order_items' },
    (payload) => {
      console.log(`\n[${new Date().toISOString()}] EVENT order_items: ${payload.eventType}`);
      triggerInvalidate('order_items');
    }
  )
  .subscribe((status) => {
    console.log('Status langganan:', status);
  });

setTimeout(() => {
  console.log('Berhenti memonitor.');
  process.exit(0);
}, 30000); // listen for 30s
