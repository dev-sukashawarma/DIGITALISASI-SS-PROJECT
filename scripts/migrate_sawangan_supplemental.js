const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function runSupplementalMigration() {
  const oldOutletId = '550e8400-e29b-41d4-a716-446655440008';
  const newOutletId = '5a4df577-5237-476e-b54c-9eb642a5a516';

  console.log('=== MIGRASI DATA TAMBAHAN HASIL DEEP DIVE ===');

  // 1. Shifts (26-27 Sept)
  console.log('\n1. Migrasi shifts kasir (>= 26 Sept)...');
  const { data: upShifts, error: errShifts } = await supabase
    .from('shifts')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('created_at', '2026-09-26T00:00:00+07:00')
    .select('id, start_time, end_time, actual_ending_cash');
  if (errShifts) console.error('Error shifts:', errShifts);
  else console.log(`Berhasil memindahkan ${upShifts?.length} shift:`, upShifts);

  // 2. Petty cash adjustments
  console.log('\n2. Migrasi petty cash adjustment pending...');
  const { data: upAdj, error: errAdj } = await supabase
    .from('petty_cash_adjustments')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('created_at', '2026-09-26T00:00:00+07:00')
    .select('id, adjustment_amount, status');
  if (errAdj) console.error('Error adjustment:', errAdj);
  else console.log(`Berhasil memindahkan ${upAdj?.length} adjustment:`, upAdj);

  // 3. Stok waste reports
  console.log('\n3. Migrasi stok waste report (26 Sept)...');
  const { data: upWaste, error: errWaste } = await supabase
    .from('stok_waste_reports')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('created_at', '2026-09-26T00:00:00+07:00')
    .select('id, qty, status');
  if (errWaste) console.error('Error waste:', errWaste);
  else console.log(`Berhasil memindahkan ${upWaste?.length} waste report:`, upWaste);

  // 4. POS Endorsements
  console.log('\n4. Migrasi POS endorsements (26 Sept)...');
  const { data: upEndo, error: errEndo } = await supabase
    .from('pos_endorsements')
    .update({ outlet_id: newOutletId, outlet_name: 'Mitra Sawangan DTC' })
    .eq('outlet_id', oldOutletId)
    .gte('schedule_date', '2026-09-26')
    .select('id, kol_name, status');
  if (errEndo) console.error('Error endorsements:', errEndo);
  else console.log(`Berhasil memindahkan ${upEndo?.length} endorsements:`, upEndo?.map(e => e.kol_name));

  // 5. Staff outlets (Helmi & Devai)
  console.log('\n5. Migrasi staff_outlets untuk absensi lapangan...');
  const staffIds = [
    '0ad0c9fe-0877-4173-b365-fe1e1ac7c7db', // Helmi
    '5c9419e9-2ae8-48e0-9754-dc72d0bfd8f4'  // Devai
  ];
  const { data: upSo, error: errSo } = await supabase
    .from('staff_outlets')
    .update({ outlet_id: newOutletId })
    .in('staff_id', staffIds)
    .select('*');
  if (errSo) console.error('Error staff_outlets:', errSo);
  else console.log(`Berhasil memindahkan ${upSo?.length} staff_outlets:`, upSo);

  // 6. Attendance records (>= 26 Sept)
  console.log('\n6. Migrasi riwayat attendance (>= 26 Sept)...');
  const { data: upAtt, error: errAtt } = await supabase
    .from('attendance')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('ts_server', '2026-09-26T00:00:00+07:00')
    .select('id, ts_server, type');
  if (errAtt) console.error('Error attendance:', errAtt);
  else console.log(`Berhasil memindahkan ${upAtt?.length} riwayat absensi:`, upAtt);

  // 7. Surat Jalan (>= 26 Sept)
  console.log('\n7. Migrasi surat jalan (>= 26 Sept)...');
  const { data: upSj, error: errSj } = await supabase
    .from('surat_jalan')
    .update({ outlet_id: newOutletId })
    .eq('outlet_id', oldOutletId)
    .gte('created_at', '2026-09-26T00:00:00+07:00')
    .select('id, status, verification_code');
  if (errSj) console.error('Error surat_jalan:', errSj);
  else console.log(`Berhasil memindahkan ${upSj?.length} surat jalan:`, upSj);

  // 8. Permintaan Bahan terkait surat jalan tersebut
  console.log('\n8. Migrasi permintaan bahan pengiriman transisi...');
  const { data: upPb, error: errPb } = await supabase
    .from('permintaan_bahan')
    .update({ outlet_id: newOutletId })
    .eq('id', 'ca8e858d-2304-4df8-8791-e8e5dfd13ec2')
    .select('id, status');
  if (errPb) console.error('Error permintaan_bahan:', errPb);
  else console.log(`Berhasil memindahkan ${upPb?.length} permintaan bahan:`, upPb);

  console.log('\n=== SELESAI SINKRONISASI DATA TAMBAHAN ===');
}

runSupplementalMigration().catch(console.error);
