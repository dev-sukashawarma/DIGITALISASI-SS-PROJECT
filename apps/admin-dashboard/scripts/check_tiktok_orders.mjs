import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'apps/admin-dashboard/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDb() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, source, channel, created_at, outlet:outlets(name)')
    .ilike('channel', '%tiktok%')
    .limit(10)
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Sample TikTok Orders:', JSON.stringify(data, null, 2))
  
  // Let's also check all distinct channels
  const { data: channels } = await supabase
    .from('orders')
    .select('channel')
    
  if (channels) {
    const uniqueChannels = [...new Set(channels.map(c => c.channel))]
    console.log('\nUnique Channels in DB:', uniqueChannels)
  }
}

checkDb()
