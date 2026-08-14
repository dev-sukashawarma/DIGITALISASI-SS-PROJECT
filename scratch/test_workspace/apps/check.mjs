import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkWaste() {
  const { data: outlets, error: outletErr } = await supabase.from('outlets').select('id, name')
  if (outletErr) {
    console.error('Outlet fetch error:', outletErr)
    return
  }
  
  const jatiasih = outlets.find(o => o.name.toLowerCase().includes('jatiasih'))
  if (!jatiasih) {
    console.log('Jatiasih outlet not found')
    return
  }
  
  console.log('Jatiasih ID:', jatiasih.id, 'Name:', jatiasih.name)
  
  const { data: wasteData, error: wasteErr } = await supabase.from('waste').select('*').eq('outlet_id', jatiasih.id)
  
  if (wasteErr) {
    console.log('Waste table query error:', wasteErr.message)
    const { data: opnameData, error: opnameErr } = await supabase.from('opname').select('id, created_at, status, notes').eq('outlet_id', jatiasih.id).order('created_at', {ascending: false}).limit(1)
    console.log('Recent opname:', opnameData)
    if (opnameData && opnameData.length > 0) {
      const { data: items } = await supabase.from('opname_item').select('bahan_baku(nama), qty_fisik, qty_system, selisih, catatan').eq('opname_id', opnameData[0].id)
      const wasteItems = items.filter(i => Number(i.selisih) < 0)
      console.log('Minus items in latest opname:', JSON.stringify(wasteItems, null, 2))
    }
  } else {
    console.log('Waste data:', JSON.stringify(wasteData, null, 2))
  }
}

checkWaste()
