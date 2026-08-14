import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
)

async function checkOtherTables() {
  const { data: outlets } = await supabase.from('outlets').select('id, name')
  const jatiasih = outlets.find(o => o.name.toLowerCase().includes('jatiasih'))
  
  // Try querying a few other potential names for waste
  const checks = ['voids', 'shrinkage', 'waste_records', 'pengeluaran', 'mutasi']
  for (const table of checks) {
    const { data, error } = await supabase.from(table).select('*').limit(1)
    if (!error) {
      console.log(`Table '${table}' exists! Found ${data.length} records.`)
      // Check for jatiasih
      const { data: jatiasihData } = await supabase.from(table).select('*').eq('outlet_id', jatiasih.id).limit(5)
      if (jatiasihData && jatiasihData.length > 0) {
         console.log(`Jatiasih data in ${table}:`, jatiasihData)
      } else {
         console.log(`No data for Jatiasih in ${table}`)
      }
    } else {
      console.log(`Table '${table}' does not exist or error:`, error.message)
    }
  }
}

checkOtherTables()
