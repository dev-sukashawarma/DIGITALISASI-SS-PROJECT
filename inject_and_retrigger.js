require('dotenv').config({ path: 'apps/pos-kasir/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: outlets, error: outletErr } = await supabase
    .from('outlets')
    .select('id, name')
    .ilike('name', '%depok%')
    .limit(5);

  if (outletErr || outlets.length === 0) {
    console.log('Outlet tidak ditemukan.');
    return;
  }
  
  const targetOutlet = outlets.find(o => o.name.toLowerCase().includes('sukmajaya')) || outlets[0];
  console.log(`Menemukan outlet: ${targetOutlet.name} (ID: ${targetOutlet.id})`);
  
  const { data: bahanBaku, error: bahanErr } = await supabase
    .from('bahan_baku')
    .select('id, nama')
    .eq('is_active', true);
    
  if (bahanErr || !bahanBaku || bahanBaku.length === 0) {
    console.log('Gagal mengambil data bahan baku:', bahanErr);
    return;
  }

  console.log(`Menyuntikkan stok dummy (100 qty) untuk ${bahanBaku.length} bahan baku di outlet ini...`);
  
  for (const bahan of bahanBaku) {
    const { error: insErr } = await supabase.from('ledger_stok').insert({
      outlet_id: targetOutlet.id,
      bahan_baku_id: bahan.id,
      tipe: 'opname_selisih',
      qty: 100,
      catatan: 'Suntik stok dummy untuk testing POS'
    });
    if (insErr) {
      console.error(`Gagal suntik ${bahan.nama}:`, insErr.message);
    }
  }
  console.log('Suntik stok selesai!');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('outlet_id', targetOutlet.id)
    .eq('status', 'completed')
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
      console.log(`-> Order #${order.order_number} belum ada ledger. Retriggering...`);
      await supabase.from('orders').update({ status: 'pending' }).eq('id', order.id);
      const { error: err } = await supabase.from('orders').update({ status: 'completed' }).eq('id', order.id);
      if (err) {
        console.error('Gagal memproses ulang order:', err.message);
      } else {
        console.log(`   Berhasil re-trigger Order #${order.order_number}!`);
        count++;
      }
    }
  }
  console.log(`Selesai! Berhasil re-trigger ${count} pesanan di outlet ${targetOutlet.name}.`);
}

main();
