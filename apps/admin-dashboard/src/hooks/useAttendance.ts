import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AttendanceLog, AttendanceFilterValues } from '@/lib/types'

export function useAttendance(filter: AttendanceFilterValues) {
  const supabase = createClient()

  return useQuery<AttendanceLog[]>({
    queryKey: ['attendance', filter],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let q = supabase
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

      if (filter.outletId) {
        q = q.eq('outlet_id', filter.outletId)
      }

      if (filter.status && filter.status !== 'all') {
        q = q.eq('status', filter.status)
      }

      const { data, error } = await q
      if (error) throw error
      const logs = (data ?? []) as AttendanceLog[]

      // Ambil data koordinat asli dari tabel attendance
      const staffIds = Array.from(new Set(logs.map((l) => l.staff_id)))
      if (staffIds.length > 0) {
        const { data: rawAtt } = await supabase
          .from('attendance')
          .select('outlet_staff_id, type, gps_lat, gps_lng, ts_server')
          .in('outlet_staff_id', staffIds)
          .gte('ts_server', `${filter.dateFrom}T00:00:00.000Z`)
          .lte('ts_server', `${filter.dateTo}T23:59:59.999Z`)
          .not('gps_lat', 'is', null)

        if (rawAtt) {
          for (const log of logs) {
            // Cari absen masuk (in) pada tanggal yang sama
            const inRecord = rawAtt.find(
              (r) =>
                r.outlet_staff_id === log.staff_id &&
                r.type === 'in' &&
                r.ts_server.startsWith(log.date)
            )
            if (inRecord) {
              log.clock_in_lat = inRecord.gps_lat
              log.clock_in_lng = inRecord.gps_lng
            }

            // Cari absen pulang (out) pada tanggal yang sama
            const outRecord = rawAtt.find(
              (r) =>
                r.outlet_staff_id === log.staff_id &&
                r.type === 'out' &&
                r.ts_server.startsWith(log.date)
            )
            if (outRecord) {
              log.clock_out_lat = outRecord.gps_lat
              log.clock_out_lng = outRecord.gps_lng
            }
          }
        }
      }

      return logs
    },
  })
}
