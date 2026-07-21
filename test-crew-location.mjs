import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: 'apps/admin-dashboard/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const room = supabase.channel('room:crew_location')

room.on('presence', { event: 'sync' }, () => {
  console.log('Presence synced')
})
.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    console.log('Subscribed! Broadcasting dummy crew location...')
    await room.track({
      outlet_id: '4bd97e68-075e-4c75-ba97-e818815f9b4c', // Cicurug outlet ID (example, actually we don't know if this exists but it matches the screenshot vaguely)
      staff_id: 'dummy-staff-123',
      staff_name: 'AGEN 007 (SIMULASI)',
      role: 'crew',
      lat: -6.745199,
      lng: 106.786526, // Somewhere near Cicurug
      updated_at: new Date().toISOString()
    })
    
    await room.track({
      outlet_id: 'dummy-outlet',
      staff_id: 'dummy-staff-456',
      staff_name: 'JAMES BOND (SIMULASI)',
      role: 'leader',
      lat: -6.600000,
      lng: 106.800000, // Somewhere near Bogor
      updated_at: new Date().toISOString()
    })
    console.log('Broadcasted!')
  }
})

// Keep alive
setInterval(() => {}, 1000)
