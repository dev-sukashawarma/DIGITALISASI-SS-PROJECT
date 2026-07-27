const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Total waste reports (yang MASUK dashboard Kerugian Waste)
  const { data: wasteReports, error: wasteErr } = await supabase
    .from('stok_waste_reports')
    .select('id, outlet_id, bahan_baku_id, qty, status, created_at')
    .eq('status', 'APPROVED');

  if (wasteErr) {
    console.error('waste error', wasteErr);
    return;
  }

  console.log('=== stok_waste_reports (APPROVED) ===');
  console.log('Jumlah laporan:', wasteReports.length);

  // 2. Ledger entries tipe opname_selisih yang NEGATIF (susut) — TIDAK masuk dashboard
  const { data: opnameSelisih, error: ledgerErr } = await supabase
    .from('ledger_stok')
    .select('id, outlet_id, bahan_baku_id, qty, created_at')
    .eq('tipe', 'opname_selisih')
    .lt('qty', 0);

  if (ledgerErr) {
    console.error('ledger error', ledgerErr);
    return;
  }

  console.log('\n=== ledger_stok tipe=opname_selisih, qty<0 (susut dari opname) ===');
  console.log('Jumlah baris:', opnameSelisih.length);

  if (opnameSelisih.length === 0) {
    console.log('Tidak ada data opname_selisih negatif sama sekali.');
    return;
  }

  const dates = opnameSelisih.map(r => new Date(r.created_at).getTime());
  console.log('Rentang tanggal:', new Date(Math.min(...dates)).toISOString(), '->', new Date(Math.max(...dates)).toISOString());

  const perOutlet = {};
  opnameSelisih.forEach(r => {
    perOutlet[r.outlet_id] = (perOutlet[r.outlet_id] || 0) + 1;
  });
  console.log('\nJumlah outlet unik terdampak:', Object.keys(perOutlet).length);

  const bahanIds = [...new Set(opnameSelisih.map(r => r.bahan_baku_id))];
  const { data: bahanData } = await supabase
    .from('bahan_baku')
    .select('id, nama, harga_beli, satuan')
    .in('id', bahanIds);
  const priceMap = new Map((bahanData || []).map(b => [b.id, b]));

  let totalQtyLoss = 0;
  let totalEstRupiah = 0;
  const perBahan = {};

  opnameSelisih.forEach(r => {
    const absQty = Math.abs(r.qty);
    totalQtyLoss += absQty;
    const bahan = priceMap.get(r.bahan_baku_id);
    const harga = bahan?.harga_beli || 0;
    const estRupiah = absQty * harga;
    totalEstRupiah += estRupiah;

    const key = bahan?.nama || r.bahan_baku_id;
    if (!perBahan[key]) perBahan[key] = { qty: 0, rupiah: 0, count: 0, satuan: bahan?.satuan || '?' };
    perBahan[key].qty += absQty;
    perBahan[key].rupiah += estRupiah;
    perBahan[key].count += 1;
  });

  console.log('\nTotal estimasi nilai kerugian dari opname_selisih (harga beli saat ini x qty):', totalEstRupiah.toLocaleString('id-ID'), 'rupiah');

  console.log('\n=== Top 10 bahan by estimasi rupiah (dari opname_selisih, TIDAK masuk dashboard waste) ===');
  const sorted = Object.entries(perBahan).sort((a, b) => b[1].rupiah - a[1].rupiah).slice(0, 10);
  sorted.forEach(([nama, v]) => {
    console.log(`${nama}: ${v.count}x, total ${v.qty.toFixed(2)} ${v.satuan}, est Rp ${v.rupiah.toLocaleString('id-ID')}`);
  });

  const wasteBahanIds = [...new Set(wasteReports.map(r => r.bahan_baku_id))];
  const { data: wasteBahanData } = await supabase
    .from('bahan_baku')
    .select('id, harga_beli')
    .in('id', wasteBahanIds);
  const wastePriceMap = new Map((wasteBahanData || []).map(b => [b.id, b.harga_beli || 0]));
  let totalWasteRupiah = 0;
  wasteReports.forEach(r => {
    totalWasteRupiah += Math.abs(r.qty) * (wastePriceMap.get(r.bahan_baku_id) || 0);
  });

  console.log('\n=== Perbandingan ===');
  console.log('Total est. rupiah waste report (SUDAH masuk dashboard):', totalWasteRupiah.toLocaleString('id-ID'));
  console.log('Total est. rupiah opname_selisih negatif (BELUM masuk dashboard):', totalEstRupiah.toLocaleString('id-ID'));
  const gapPct = totalWasteRupiah > 0 ? (totalEstRupiah / totalWasteRupiah * 100) : null;
  console.log('Opname_selisih sebagai % dari waste report yang sudah tercatat:', gapPct !== null ? gapPct.toFixed(1) + '%' : 'N/A (waste report = 0)');
}

main().catch(console.error);
