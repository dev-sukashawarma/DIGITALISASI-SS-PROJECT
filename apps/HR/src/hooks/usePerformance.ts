import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PerformanceRecord } from '@/lib/types'

export function usePerformance(month: number, year: number, outletFilter?: string) {
  const supabase = createClient()

  return useQuery<PerformanceRecord[]>({
    queryKey: ['performance', month, year, outletFilter],
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Fetch active staff
      let staffQuery = supabase
        .from('outlet_staff')
        .select(`
          id, name, role, is_bonus_eligible,
          outlets!outlet_staff_outlet_id_fkey(name)
        `)
        .eq('status', 'active')
        .neq('role', 'kiosk')

      if (outletFilter && outletFilter !== 'all') {
        staffQuery = staffQuery.eq('outlet_id', outletFilter)
      }

      const { data: staffList, error: staffErr } = await staffQuery
      if (staffErr) throw staffErr
      if (!staffList || !staffList.length) return []

      // 2. Format start & end of month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      // 3. Fetch attendance in that period
      const { data: attData } = await supabase
        .from('attendance')
        .select('outlet_staff_id, status, telat_menit')
        .gte('ts_server', `${startDate}T00:00:00.000+07:00`)
        .lte('ts_server', `${endDate}T23:59:59.999+07:00`)

      // 4. Fetch payroll records to get bonus
      const { data: payrollData } = await supabase
        .from('payroll_records')
        .select('staff_id, bonus')
        .eq('period_month', month)
        .eq('period_year', year)

      const bonusMap = new Map<string, number>()
      ;(payrollData ?? []).forEach((p) => bonusMap.set(p.staff_id, p.bonus || 0))

      // Group attendance
      const attMap = new Map<string, { total: number; onTime: number; lateMinutes: number }>()
      ;(attData ?? []).forEach((a) => {
        const sid = a.outlet_staff_id
        if (!attMap.has(sid)) {
          attMap.set(sid, { total: 0, onTime: 0, lateMinutes: 0 })
        }
        const st = attMap.get(sid)!
        st.total += 1
        if (a.status === 'hadir') {
          st.onTime += 1
        } else if (a.status === 'telat' || a.status === 'terlambat' || a.status === 'telat_toleransi') {
          st.lateMinutes += a.telat_menit || 0
        }
      })

      return staffList.map((s: any) => {
        const att = attMap.get(s.id) || { total: 0, onTime: 0, lateMinutes: 0 }
        const totalWorkingDays = att.total || 0
        const punctualityRate = totalWorkingDays > 0 ? Math.round((att.onTime / totalWorkingDays) * 100) : 100
        const attendanceRate = Math.min(100, Math.round((totalWorkingDays / 26) * 100))

        // Calculate KPI score: 50% punctuality + 50% attendance
        const kpiScore = Math.round(punctualityRate * 0.5 + attendanceRate * 0.5)

        let grade: 'A' | 'B' | 'C' | 'D' = 'C'
        if (kpiScore >= 90) grade = 'A'
        else if (kpiScore >= 75) grade = 'B'
        else if (kpiScore >= 60) grade = 'C'
        else grade = 'D'

        return {
          staff_id: s.id,
          staff_name: s.name,
          role: s.role?.replace('_', ' ').toUpperCase() || 'STAFF',
          outlet_name: s.outlets?.name || 'Semua Outlet',
          period: `${year}-${String(month).padStart(2, '0')}`,
          attendance_rate: attendanceRate,
          punctuality_rate: punctualityRate,
          total_working_days: totalWorkingDays,
          total_late_minutes: att.lateMinutes,
          crew_bonus: bonusMap.get(s.id) || 0,
          kpi_score: kpiScore,
          grade,
        }
      })
    },
  })
}
