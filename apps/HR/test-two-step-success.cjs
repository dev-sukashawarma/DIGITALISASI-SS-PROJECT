require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function test() {
  let query = supabase
    .from('attendance')
    .select(`
      id, outlet_staff_id, outlet_id, type, ts_server, status,
      selfie_url, gps_lat, gps_lng, telat_menit, is_manual_button,
      outlets!attendance_outlet_id_fkey(name)
    `)
    .order('ts_server', { ascending: false })
    .limit(1000)

  query = query.gte('ts_server', '2026-09-01T00:00:00.000+07:00')
  query = query.lte('ts_server', '2026-09-30T23:59:59.999+07:00')

  let { data: rawRows, error } = await query
  
  if (error) {
    console.error('Error fetching attendance:', error)
    return
  }
  
  if (rawRows.length > 0) {
    const staffIds = Array.from(new Set(rawRows.map(r => r.outlet_staff_id).filter(Boolean)))
    if (staffIds.length > 0) {
      const { data: staffs } = await supabase
        .from('outlet_staff')
        .select('id, name, role, username')
        .in('id', staffIds)
      
      if (staffs) {
        const staffMap = new Map(staffs.map(s => [s.id, s]))
        rawRows = rawRows.map(r => ({
          ...r,
          outlet_staff: staffMap.get(r.outlet_staff_id) || null
        }))
      }
    }
  }

  console.log('rawRows mapped:', rawRows.slice(0, 2))
}
test()
