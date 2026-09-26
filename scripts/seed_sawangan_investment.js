const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const sawanganId = '550e8400-e29b-41d4-a716-446655440008';

  console.log('--- 1. UPSERT MITRA INVESTMENTS FOR SAWANGAN ---');
  const { data: inv, error: errInv } = await supabase
    .from('mitra_investments')
    .upsert({
      outlet_id: sawanganId,
      nilai_investasi: 0,
      tanggal_mulai: '2026-09-26',
      catatan: 'Peralihan cabang internal ke kemitraan per 26 Sept 2026',
      persentase_bagi_hasil: 100,
      management_fee: 3,
      is_profit_sharing_active: true,
      omzet_historis: 0,
      transfer_historis: 0
    }, { onConflict: 'outlet_id' })
    .select();
  
  if (errInv) {
    console.error('Error upsert mitra_investments:', errInv);
    process.exit(1);
  }
  console.log('mitra_investments row:', inv);

  console.log('\n--- 2. UPDATE TANGGAL PKS IN MITRA PROFILES ---');
  const { data: prof, error: errProf } = await supabase
    .from('mitra_profiles')
    .update({ 
      tanggal_pks: '2026-09-26',
      updated_at: new Date().toISOString()
    })
    .contains('outlet_ids', [sawanganId])
    .select();
  
  if (errProf) {
    console.error('Error update mitra_profiles:', errProf);
    process.exit(1);
  }
  console.log('mitra_profiles updated row:', prof);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
