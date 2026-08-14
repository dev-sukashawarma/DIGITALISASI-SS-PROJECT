import { createClient } from '@supabase/supabase-js'

const url = 'https://khpkoreaaucvyqfhynfq.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase.from('outlets').select('name, type')
  if (error) {
    console.error(error)
    return
  }
  
  const internal = data.filter(d => d.type === 'outlet').map(d => d.name)
  const mitra = data.filter(d => d.type === 'mitra').map(d => d.name)
  const system = data.filter(d => d.type === 'system').map(d => d.name)
  
  console.log('INTERNAL:', internal)
  console.log('MITRA:', mitra)
  console.log('SYSTEM:', system)
}
run()
