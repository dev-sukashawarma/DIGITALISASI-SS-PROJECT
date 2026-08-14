import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function main() {
  const outletId = '662b694b-4cb6-417c-a496-eec5be174e98'
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('mitra_investments')
    .select('id')
    .eq('outlet_id', outletId)
    .single()

  const payload = {
    outlet_id: outletId,
    nilai_investasi: 125000000,
    tanggal_mulai: '2026-06-01', // Example date
    omzet_historis: 178798663, // Profit from June
    transfer_historis: 0,
    is_profit_sharing_active: true,
    persentase_bagi_hasil: 50,
    management_fee: 0
  }

  if (existing) {
    console.log('Updating existing...')
    const { error } = await supabase.from('mitra_investments').update(payload).eq('id', existing.id)
    if (error) console.error(error)
    else console.log('Updated!')
  } else {
    console.log('Inserting new...')
    const { error } = await supabase.from('mitra_investments').insert([payload])
    if (error) console.error(error)
    else console.log('Inserted!')
  }
}

main()
