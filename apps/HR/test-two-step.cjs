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
      selfie_url, gps_lat, gps_lng, is_mock_location, telat_menit,
      outlets!attendance_outlet_id_fkey(name)
    `)
    .order('ts_server', { ascending: false })
    .limit(1000)

  query = query.gte('ts_server', '2026-09-01T00:00:00.000+07:00')
  query = query.lte('ts_server', '2026-09-30T23:59:59.999+07:00')

  const { data: rawRows, error } = await query

  console.log('rawRows:', rawRows?.length, 'error:', error)
  if (rawRows?.length > 0) {
    const staffIds = [...new Set(rawRows.map(r => r.outlet_staff_id))]
    const { data: staffs } = await supabase.from('outlet_staff').select('id, name, role, username').in('id', staffIds)
    console.log('staffs fetched:', staffs?.length)
    // map staffs back
    const staffMap = new Map(staffs.map(s => [s.id, s]))
    for (let r of rawRows) {
      r.outlet_staff = staffMap.get(r.outlet_staff_id)
    }
    console.log(rawRows[0])
  }
}
test()
