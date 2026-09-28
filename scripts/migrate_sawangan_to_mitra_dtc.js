const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function migrate() {
  const oldOutletId = '550e8400-e29b-41d4-a716-446655440008';
  const newOutletId = crypto.randomUUID();

  console.log(`[MIGRATION START]`);
  console.log(`Outlet Lama (Internal): ${oldOutletId}`);
  console.log(`Outlet Baru (Mitra):    ${newOutletId}`);

  // 1. Fetch data outlet lama untuk dijadikan template outlet baru
  const { data: oldOutlet, error: errGetOld } = await supabase
    .from('outlets')
    .select('*')
    .eq('id', oldOutletId)
    .single();

  if (errGetOld || !oldOutlet) {
    console.error('Gagal mengambil data outlet lama:', errGetOld);
    process.exit(1);
  }

  // 2. Buat Outlet Baru 'MITRA SAWANGAN DTC'
  console.log('\n--- 1. INSERT OUTLET BARU: MITRA SAWANGAN DTC ---');
  const newOutletPayload = {
    ...oldOutlet,
    id: newOutletId,
    name: 'MITRA SAWANGAN DTC',
    slug: 'mitra-sawangan-dtc',
    type: 'mitra',
    is_active: true,
    inactive_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data: insOutlet, error: errInsOutlet } = await supabase
    .from('outlets')
    .insert([newOutletPayload])
    .select()
    .single();

  if (errInsOutlet) {
    console.error('Gagal insert outlet baru:', errInsOutlet);
    process.exit(1);
  }
  console.log('Outlet baru berhasil dibuat:', insOutlet.id, insOutlet.name);

  // 3. Update Outlet Lama -> Arsipkan sebagai SUKA SHAWARMA SAWANGAN (INTERNAL)
  console.log('\n--- 2. ARSIPKAN OUTLET LAMA: SUKA SHAWARMA SAWANGAN (INTERNAL) ---');
  const { data: upOldOutlet, error: errUpOldOutlet } = await supabase
    .from('outlets')
    .update({
      name: 'SUKA SHAWARMA SAWANGAN (INTERNAL)',
      slug: 'sawangan-depok-internal',
      type: 'outlet',
      is_active: false,
      inactive_reason: 'Beralih status menjadi Mitra Sawangan DTC per 26 Sept 2026',
      updated_at: new Date().toISOString()
    })
    .eq('id', oldOutletId)
    .select()
    .single();

  if (errUpOldOutlet) {
    console.error('Gagal update outlet lama:', errUpOldOutlet);
    process.exit(1);
  }
  console.log('Outlet lama berhasil diarsipkan:', upOldOutlet.id, upOldOutlet.name, `is_active: ${upOldOutlet.is_active}`);

  // 4. Migrasi Orders (>= 26 Sept 2026)
  console.log('\n--- 3. MIGRASI ORDERS (>= 26 SEPT 2026) ---');
  const { data: migratedOrders, error: errOrders } = await supabase
    .from('orders')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('created_at', '2026-09-26T00:00:00+07:00')
    .select('id');

  if (errOrders) {
    console.error('Gagal migrasi orders:', errOrders);
    process.exit(1);
  }
  console.log(`Berhasil memindahkan ${migratedOrders?.length || 0} transaksi ke outlet baru.`);

  // 5. Migrasi Opname (>= 26 Sept 2026)
  console.log('\n--- 4. MIGRASI OPNAME (>= 26 SEPT 2026) ---');
  const { data: migratedOpname, error: errOpname } = await supabase
    .from('opname')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('tanggal', '2026-09-26')
    .select('id, tanggal');

  if (errOpname) {
    console.error('Gagal migrasi opname:', errOpname);
    process.exit(1);
  }
  console.log(`Berhasil memindahkan ${migratedOpname?.length || 0} opname:`, migratedOpname);

  // 6. Migrasi Petty Cash Expenses (>= 26 Sept 2026)
  console.log('\n--- 5. MIGRASI PETTY CASH (>= 26 SEPT 2026) ---');
  const { data: migratedPc, error: errPc } = await supabase
    .from('petty_cash_expenses')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('expense_date', '2026-09-26')
    .select('id, amount, description');

  if (errPc) {
    console.error('Gagal migrasi petty cash:', errPc);
    process.exit(1);
  }
  console.log(`Berhasil memindahkan ${migratedPc?.length || 0} petty cash expenses:`, migratedPc);

  // 7. Salin Stok Balance ke Outlet Baru
  console.log('\n--- 6. DUPLIKASI SALDO STOK KE OUTLET BARU ---');
  const { data: oldStock, error: errGetStock } = await supabase
    .from('stok_balance')
    .select('bahan_baku_id, saldo')
    .eq('outlet_id', oldOutletId);

  if (errGetStock) {
    console.error('Gagal membaca saldo stok lama:', errGetStock);
    process.exit(1);
  }

  if (oldStock && oldStock.length > 0) {
    const newStockRows = oldStock.map(s => ({
      outlet_id: newOutletId,
      bahan_baku_id: s.bahan_baku_id,
      saldo: s.saldo,
      updated_at: new Date().toISOString()
    }));

    const { data: insStock, error: errInsStock } = await supabase
      .from('stok_balance')
      .insert(newStockRows)
      .select('id');

    if (errInsStock) {
      console.error('Gagal insert stok balance baru:', errInsStock);
      process.exit(1);
    }
    console.log(`Berhasil menyalin ${insStock?.length || 0} baris saldo stok ke outlet baru.`);
  }

  // 8. Update Outlet Staff (Alihkan Akun ke Outlet Baru)
  console.log('\n--- 7. ALAMATKAN STAF KE OUTLET BARU ---');
  const staffIds = [
    'd212ef87-afd4-4160-8a3e-86a7531dd7aa', // Ibu Ines (mitra)
    '0ad0c9fe-0877-4173-b365-fe1e1ac7c7db', // Helmi (leader)
    '5c9419e9-2ae8-48e0-9754-dc72d0bfd8f4'  // Devai (crew/kasir)
  ];

  const { data: updatedStaff, error: errStaff } = await supabase
    .from('outlet_staff')
    .update({ outlet_id: newOutletId })
    .in('id', staffIds)
    .select('id, name, username, role, outlet_id');

  if (errStaff) {
    console.error('Gagal update staf outlet:', errStaff);
    process.exit(1);
  }
  console.log('Staf berhasil dialihkan ke outlet baru:', updatedStaff);

  // 9. Update Mitra Investments
  console.log('\n--- 8. UPDATE MITRA INVESTMENTS ---');
  const { data: upInv, error: errInv } = await supabase
    .from('mitra_investments')
    .update({
      outlet_id: newOutletId,
      tanggal_mulai: '2026-09-26',
      catatan: 'Peralihan resmi Mitra Sawangan DTC per 26 Sept 2026'
    })
    .eq('outlet_id', oldOutletId)
    .select();

  if (errInv) {
    console.error('Gagal update mitra_investments:', errInv);
    process.exit(1);
  }
  console.log('Mitra investments berhasil dialihkan:', upInv);

  // 10. Update Mitra Profiles
  console.log('\n--- 9. UPDATE MITRA PROFILES ---');
  const { data: upProf, error: errProf } = await supabase
    .from('mitra_profiles')
    .update({
      nama_mitra: 'Mitra Sawangan DTC',
      outlet_ids: [newOutletId],
      updated_at: new Date().toISOString()
    })
    .contains('outlet_ids', [oldOutletId])
    .select();

  if (errProf) {
    console.error('Gagal update mitra_profiles:', errProf);
    process.exit(1);
  }
  console.log('Mitra profiles berhasil dialihkan:', upProf);

  // 11. Salin Kiosk Settings
  console.log('\n--- 10. SALIN KIOSK SETTINGS ---');
  const { data: oldKiosk } = await supabase
    .from('kiosk_settings')
    .select('key, value')
    .eq('outlet_id', oldOutletId);

  if (oldKiosk && oldKiosk.length > 0) {
    const newKioskRows = oldKiosk.map(k => ({
      outlet_id: newOutletId,
      key: k.key,
      value: k.value,
      updated_at: new Date().toISOString()
    }));

    await supabase.from('kiosk_settings').insert(newKioskRows);
    console.log(`Berhasil menyalin ${newKioskRows.length} setting kiosk.`);
  }

  console.log('\n[MIGRATION COMPLETED SUCCESSFULLY!]');
}

migrate().catch(e => {
  console.error('Fatal error saat migrasi:', e);
  process.exit(1);
});
