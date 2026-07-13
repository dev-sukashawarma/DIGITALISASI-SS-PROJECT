require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Mencari pesanan hari ini yang belum terpotong stoknya...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, status, created_at, outlet_id')
    .eq('status', 'completed')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  let count = 0;
  for (const order of orders) {
    // Check if there are any ledger entries for this order
    const { data: ledgers, error: ledErr } = await supabase
      .from('ledger_stok')
      .select('id')
      .eq('ref_order_id', order.id)
      .limit(1);

    if (ledgers && ledgers.length === 0) {
      console.log(`-> Order #${order.order_number} (Outlet: ${order.outlet_id}) belum ada ledger. Retriggering...`);
      
      // Update to 'pending' briefly
      const { error: err1 } = await supabase.from('orders').update({ status: 'pending' }).eq('id', order.id);
      if (err1) {
          console.error(`Gagal update ke pending:`, err1);
          continue;
      }
      
      // Update back to 'completed' to trigger BOM automation
      const { error: err2 } = await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id);
      if (err2) {
          console.error(`Gagal update ke completed:`, err2);
          continue;
      }
      
      console.log(`   Berhasil re-trigger Order #${order.order_number}! Stok seharusnya sudah terpotong.`);
      count++;
    }
  }
  
  if (count === 0) {
    console.log('Tidak ada pesanan completed yang perlu di-retrigger (semua sudah ada ledgernya atau tidak ada transaksi baru).');
  } else {
    console.log(`Selesai memproses ulang ${count} pesanan!`);
  }
}

main();
