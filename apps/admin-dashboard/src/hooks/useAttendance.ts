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
      return (data ?? []) as AttendanceLog[]
    },
  })
}
