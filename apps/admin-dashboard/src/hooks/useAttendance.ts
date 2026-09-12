import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AttendanceLog, AttendanceFilterValues } from '@/lib/types'

type AttendanceEvent = {
  id: string
  outlet_staff_id: string
  outlet_id: string
  type: 'in' | 'out'
  ts_server: string
  status: string
  telat_menit: number | null
  source: 'web' | 'native' | null
}

function jakartaDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(timestamp))
}

function jakartaTime(timestamp: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp))
}

export function useAttendance(filter: AttendanceFilterValues) {
  const supabase = createClient()

  return useQuery<AttendanceLog[]>({
    queryKey: ['attendance', filter],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let legacyQuery = supabase
        .from('attendance_logs')
        .select(`
          id, staff_id, outlet_id, date, clock_in, clock_out,
          status, late_minutes, notes, created_at, updated_at,
          outlet_staff!attendance_logs_staff_id_fkey(name, role),
          outlets!attendance_logs_outlet_id_fkey(name)
        `)
        .gte('date', filter.dateFrom)
        .lte('date', filter.dateTo)
        .order('date', { ascending: false })

      let attendanceQuery = supabase
        .from('attendance')
        .select('id, outlet_staff_id, outlet_id, type, ts_server, status, telat_menit, source')
        .gte('ts_server', `${filter.dateFrom}T00:00:00.000+07:00`)
        .lte('ts_server', `${filter.dateTo}T23:59:59.999+07:00`)
        .order('ts_server', { ascending: true })

      if (filter.outletId) {
        legacyQuery = legacyQuery.eq('outlet_id', filter.outletId)
        attendanceQuery = attendanceQuery.eq('outlet_id', filter.outletId)
      }

      if (filter.status && filter.status !== 'all') {
        legacyQuery = legacyQuery.eq('status', filter.status)
      }

      const [legacyResult, attendanceResult, staffResult, outletsResult] = await Promise.all([
        legacyQuery,
        attendanceQuery,
        supabase.from('outlet_staff').select('id, name, role'),
        supabase.from('outlets').select('id, name'),
      ])

      if (legacyResult.error) throw legacyResult.error
      if (attendanceResult.error) throw attendanceResult.error
      if (staffResult.error) throw staffResult.error
      if (outletsResult.error) throw outletsResult.error

      const staffById = new Map((staffResult.data ?? []).map((staff) => [staff.id, staff]))
      const outletById = new Map((outletsResult.data ?? []).map((outlet) => [outlet.id, outlet]))
      const grouped = new Map<string, AttendanceLog>()

      for (const event of (attendanceResult.data ?? []) as AttendanceEvent[]) {
        const date = jakartaDate(event.ts_server)
        const key = `${event.outlet_staff_id}|${event.outlet_id}|${date}`
        const staff = staffById.get(event.outlet_staff_id)
        const outlet = outletById.get(event.outlet_id)
        let row = grouped.get(key)

        if (!row) {
          row = {
            id: event.id,
            staff_id: event.outlet_staff_id,
            outlet_id: event.outlet_id,
            date,
            clock_in: null,
            clock_out: null,
            status: 'hadir',
            late_minutes: 0,
            notes: null,
            source: 'attendance',
            outlet_staff: staff ? { name: staff.name, role: staff.role } : undefined,
            outlets: outlet ? { name: outlet.name } : undefined,
          }
          grouped.set(key, row)
        }

        const eventSource = event.source === 'native' ? 'native' : 'web'
        if (event.type === 'in') {
          row.id = event.id
          row.clock_in = jakartaTime(event.ts_server)
          row.clock_in_source = eventSource
          row.late_minutes = event.telat_menit ?? 0
          row.status = event.status === 'telat' || event.status === 'telat_toleransi' ? 'terlambat' : 'hadir'
        } else {
          row.clock_out = jakartaTime(event.ts_server)
          row.clock_out_source = eventSource
        }
      }

      const attendanceRows = Array.from(grouped.values())
        .filter((row) => filter.status === 'all' || !filter.status || row.status === filter.status)
      const legacyRows = (legacyResult.data ?? []).map((row) => ({
        ...row,
        source: 'attendance_logs' as const,
      })) as AttendanceLog[]

      return [...attendanceRows, ...legacyRows].sort((a, b) => b.date.localeCompare(a.date))
    },
  })
}
