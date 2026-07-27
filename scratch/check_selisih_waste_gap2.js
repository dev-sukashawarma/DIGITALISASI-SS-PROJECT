const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: wasteReports } = await supabase
    .from('stok_waste_reports')
    .select('id, outlet_id, bahan_baku_id, qty, status, created_at');

  const byStatus = {};
  (wasteReports||[]).forEach(r => { byStatus[r.status] = (byStatus[r.status]||0)+1; });
  console.log('stok_waste_reports semua status:', byStatus, '| total:', wasteReports.length);
  if (wasteReports.length) {
    const dates = wasteReports.map(r => new Date(r.created_at).getTime());
    console.log('Rentang tanggal waste_reports:', new Date(Math.min(...dates)).toISOString(), '->', new Date(Math.max(...dates)).toISOString());
  }

  const { data: opnameSelisih, error } = await supabase
    .from('ledger_stok')
    .select('id, outlet_id, bahan_baku_id, qty, created_at, catatan')
    .eq('tipe', 'opname_selisih')
    .lt('qty', 0);
  if (error) { console.error(error); return; }

  console.log('\nledger_stok opname_selisih negatif total baris:', opnameSelisih.length);

  const bahanIds = [...new Set(opnameSelisih.map(r => r.bahan_baku_id))];
  const { data: bahanData, error: bErr } = await supabase.from('bahan_baku').select('id, nama, satuan, kategori_core').in('id', bahanIds);
  if (bErr) console.error('bahan err', bErr);
  const nameMap = new Map((bahanData||[]).map(b => [b.id, b]));

  const perBahan = {};
  opnameSelisih.forEach(r => {
    const b = nameMap.get(r.bahan_baku_id);
    const key = b?.nama || r.bahan_baku_id;
    if (!perBahan[key]) perBahan[key] = { count: 0, qty: 0, satuan: b?.satuan || '?' };
    perBahan[key].count += 1;
    perBahan[key].qty += Math.abs(r.qty);
  });
  const sorted = Object.entries(perBahan).sort((a,b) => b[1].count - a[1].count);
  console.log('\nTop bahan by frekuensi flag (opname_selisih negatif):');
  sorted.slice(0, 15).forEach(([nama, v]) => console.log(`  ${nama}: ${v.count}x, total susut ${v.qty.toFixed(2)} ${v.satuan}`));

  // Cek berapa dari opname_selisih itu yang qty besar (bukan noise pembulatan kecil)
  const bigLoss = opnameSelisih.filter(r => Math.abs(r.qty) >= 1);
  console.log('\nBaris dengan |qty| >= 1 (bukan pembulatan kecil):', bigLoss.length, '/', opnameSelisih.length);
}
main();
