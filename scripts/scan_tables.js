const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function scan() {
  const oldId = '550e8400-e29b-41d4-a716-446655440008';
  const newId = '5a4df577-5237-476e-b54c-9eb642a5a516';

  const tables = [
    'orders', 'shifts', 'petty_cash_expenses', 'petty_cash_topups', 'petty_cash_adjustments',
    'petty_cash_closings', 'petty_cash_eom', 'expenses', 'opname', 'stok_balance',
    'stok_waste_reports', 'waste_records', 'kiosk_settings', 'outlet_staff', 'mitra_investments',
    'outlet_promos', 'pos_endorsements', 'attendance', 'attendance_logs', 'platform_settlements',
    'cash_deposits', 'kasir_eom', 'permintaan_bahan'
  ];

  console.log('--- SCANNING ROWS ON OLD AND NEW OUTLET ---');
  for (const t of tables) {
    const rOld = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('outlet_id', oldId);
    const rNew = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('outlet_id', newId);
    if (!rOld.error || !rNew.error) {
      console.log(`Table ${t.padEnd(25)}: Old = ${(rOld.count ?? 'ERR').toString().padStart(5)}, New = ${(rNew.count ?? 'ERR').toString().padStart(5)}`);
    }
  }
}

scan();
