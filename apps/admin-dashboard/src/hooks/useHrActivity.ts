import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export type HrActivity = {
  id: string
  type: 'attendance' | 'leave' | 'cash_advance'
  title: string
  description: string
  timestamp: string
  status?: string
}

export function useHrActivity() {
  const supabase = createClient()

  return useQuery<HrActivity[]>({
    queryKey: ['hr-activity'],
    queryFn: async () => {
      // Fetch latest 5 from each relevant table
      const [attRes, leaveRes, cashRes] = await Promise.all([
        supabase
          .from('attendance_logs')
          .select('id, date, clock_in, status, created_at, outlet_staff!inner(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('leave_requests')
          .select('id, start_date, end_date, status, created_at, outlet_staff!leave_requests_staff_id_fkey!inner(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('cash_advances')
          .select('id, amount, status, created_at, outlet_staff!cash_advances_staff_id_fkey!inner(name)')
          .order('created_at', { ascending: false })
          .limit(5)
      ])

      const activities: HrActivity[] = []

      // Map Attendance
      if (attRes.data) {
        attRes.data.forEach(a => {
          activities.push({
            id: `att-${a.id}`,
            type: 'attendance',
            title: `Absensi: ${a.outlet_staff?.name || 'Karyawan'}`,
            description: `Clock in pada ${a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} (Status: ${a.status})`,
            timestamp: a.created_at || a.date,
            status: a.status
          })
        })
      }

      // Map Leave
      if (leaveRes.data) {
        leaveRes.data.forEach(l => {
          activities.push({
            id: `leave-${l.id}`,
            type: 'leave',
            title: `Pengajuan Cuti: ${l.outlet_staff?.name || 'Karyawan'}`,
            description: `Mengajukan cuti dari ${l.start_date} s/d ${l.end_date}`,
            timestamp: l.created_at,
            status: l.status
          })
        })
      }

      // Map Cash Advance
      if (cashRes.data) {
        cashRes.data.forEach(c => {
          activities.push({
            id: `cash-${c.id}`,
            type: 'cash_advance',
            title: `Pengajuan Kasbon: ${c.outlet_staff?.name || 'Karyawan'}`,
            description: `Meminjam kasbon sebesar Rp ${c.amount.toLocaleString('id-ID')}`,
            timestamp: c.created_at,
            status: c.status
          })
        })
      }

      // Sort combined by timestamp descending and take top 8
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      return activities.slice(0, 8)
    }
  })
}
