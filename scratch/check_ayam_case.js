const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: ayam } = await supabase.from('bahan_baku').select('id, nama').ilike('nama', 'AYAM').limit(1);
  const bahanId = ayam[0].id;

  const { data: ledgerRows } = await supabase
    .from('ledger_stok')
    .select('id, outlet_id, qty, saldo_sebelum, saldo_sesudah, catatan, ref_opname_id, created_at, outlets(name)')
    .eq('tipe', 'opname_selisih')
    .eq('bahan_baku_id', bahanId)
    .lt('qty', 0)
    .order('created_at', { ascending: false })
    .limit(3);

  for (const row of ledgerRows) {
    console.log('\n--- Ledger row ---');
    console.log('Outlet:', row.outlets?.name);
    console.log('Tanggal:', row.created_at);
    console.log('Qty (susut):', row.qty);
    console.log('Saldo sebelum -> sesudah:', row.saldo_sebelum, '->', row.saldo_sesudah);
    console.log('ref_opname_id:', row.ref_opname_id);

    if (row.ref_opname_id) {
      const { data: opnameRow } = await supabase
        .from('opname')
        .select('id, status, created_by, approved_by, created_at, outlet_staff!opname_created_by_fkey(name)')
        .eq('id', row.ref_opname_id)
        .maybeSingle();
      console.log('Opname status:', opnameRow?.status, '| dibuat oleh:', opnameRow?.outlet_staff?.name);

      const { data: itemRow } = await supabase
        .from('opname_item')
        .select('qty_fisik, qty_system, selisih, flagged')
        .eq('opname_id', row.ref_opname_id)
        .eq('bahan_baku_id', bahanId)
        .maybeSingle();
      console.log('opname_item:', itemRow);
    }
  }

  // Cek apakah ada waste report untuk AYAM di periode yang sama
  const { data: wasteAyam } = await supabase
    .from('stok_waste_reports')
    .select('id, outlet_id, qty, status, created_at')
    .eq('bahan_baku_id', bahanId);
  console.log('\nWaste report untuk AYAM (semua waktu):', wasteAyam.length, wasteAyam);
}
main();
