import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['pending', 'preparing'])
    .order('created_at', { ascending: false })
    .limit(10)
    
  if (error) {
    console.error(error)
    return
  }
  
  data.forEach(o => {
    console.log(`Order #${o.order_number} - Status: ${o.status}`)
    console.log(`Created: ${o.created_at}`)
    console.log(`Pickup Time: ${o.pickup_time}`)
    console.log(`Notes:`)
    console.log(o.notes)
    
    // mimic logic
    let timeStr = o.pickup_time
    if (!timeStr && o.notes && o.notes.includes('AMBIL')) {
      const match = o.notes.match(/AMBIL\s*[:\n]\s*(\d{2}:\d{2})/i)
      if (match) timeStr = match[1]
    }
    
    let effective = 0
    if (timeStr && typeof timeStr === 'string') {
      const timeMatch = timeStr.match(/(\d{2}):(\d{2})/)
      if (timeMatch) {
        const [_, h, m] = timeMatch
        const d = new Date(o.created_at)
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0)
        effective = d.getTime() - (20 * 60 * 1000)
      }
    }
    console.log(`TimeStr: ${timeStr}`);
    console.log(`Effective ms: ${effective}`)
    console.log(`Now ms: ${Date.now()}`)
    console.log(`In Antrean? ${effective <= Date.now()}`)
    console.log('---')
  })
}

run()
