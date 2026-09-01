import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { isTestOrDevStaff } from '@/lib/staffFilters'

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
      const [attRes, leaveRes, cashRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('id, ts_server, status, outlet_staff!inner(name, role, username)')
          .order('ts_server', { ascending: false })
          .limit(20),
        supabase
          .from('leave_requests')
          .select('id, start_date, end_date, status, created_at, outlet_staff!leave_requests_staff_id_fkey!inner(name, role, username)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('cash_advances')
          .select('id, amount, status, created_at, outlet_staff!cash_advances_staff_id_fkey!inner(name, role, username)')
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const activities: HrActivity[] = []

      if (attRes.data) {
        attRes.data
          .filter((a: any) => !isTestOrDevStaff(a.outlet_staff))
          .forEach((a: any) => {
            activities.push({
              id: `att-${a.id}`,
              type: 'attendance',
              title: `Absensi: ${a.outlet_staff?.name || 'Karyawan'}`,
              description: `Presensi tercatat pada ${a.ts_server ? new Date(a.ts_server).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}`,
              timestamp: a.ts_server,
              status: a.status,
            })
          })
      }

      if (leaveRes.data) {
        leaveRes.data
          .filter((l: any) => !isTestOrDevStaff(l.outlet_staff))
          .forEach((l: any) => {
            activities.push({
              id: `leave-${l.id}`,
              type: 'leave',
              title: `Pengajuan Cuti: ${l.outlet_staff?.name || 'Karyawan'}`,
              description: `Mengajukan cuti dari ${l.start_date} s/d ${l.end_date}`,
              timestamp: l.created_at,
              status: l.status,
            })
          })
      }

      if (cashRes.data) {
        cashRes.data
          .filter((c: any) => !isTestOrDevStaff(c.outlet_staff))
          .forEach((c: any) => {
            activities.push({
              id: `cash-${c.id}`,
              type: 'cash_advance',
              title: `Pengajuan Kasbon: ${c.outlet_staff?.name || 'Karyawan'}`,
              description: `Meminjam kasbon sebesar Rp ${c.amount.toLocaleString('id-ID')}`,
              timestamp: c.created_at,
              status: c.status,
            })
          })
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      return activities.slice(0, 8)
    },
  })
}
