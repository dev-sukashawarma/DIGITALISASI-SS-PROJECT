require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const targetOutletId = '550e8400-e29b-41d4-a716-446655440005'; // DEPOK SUKMAJAYA
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('outlet_id', targetOutletId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });

  if (orderErr) {
    console.log('Gagal mengambil pesanan:', orderErr);
    return;
  }

  let count = 0;
  for (const order of orders) {
    const { data: ledgers } = await supabase
      .from('ledger_stok')
      .select('id')
      .eq('ref_order_id', order.id)
      .limit(1);

    if (ledgers && ledgers.length === 0) {
      console.log(`-> Order #${order.order_number} (status: ${order.status}) belum ada ledger. Retriggering...`);
      
      if (order.status === 'completed') {
        await supabase.from('orders').update({ status: 'pending' }).eq('id', order.id);
      }
      
      const { error: err } = await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id);
      if (err) {
        console.error('Gagal memproses ulang order:', err.message);
      } else {
        console.log(`   Berhasil re-trigger Order #${order.order_number}!`);
        count++;
      }
    }
  }
  console.log(`Selesai! Berhasil re-trigger ${count} pesanan di outlet Sukmajaya.`);
}

main();
