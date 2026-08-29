import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { ShiftRosterItem, ShiftType } from '@/lib/types'

export function useRoster(outletId: string, startDate: string, endDate: string) {
  const supabase = createClient()
  const qc = useQueryClient()

  const query = useQuery<ShiftRosterItem[]>({
    queryKey: ['roster', outletId, startDate, endDate],
    enabled: !!outletId,
    queryFn: async () => {
      // 1. Fetch staff assigned to this outlet
      const { data: staffList, error: staffErr } = await supabase
        .from('outlet_staff')
        .select('id, name, role')
        .eq('outlet_id', outletId)
        .eq('status', 'active')

      if (staffErr) throw staffErr
      if (!staffList || !staffList.length) return []

      // 2. Fetch attendance logs to see existing logged shifts or generated roster items
      const { data: attLogs } = await supabase
        .from('attendance_logs')
        .select('id, staff_id, outlet_id, date, status, notes')
        .eq('outlet_id', outletId)
        .gte('date', startDate)
        .lte('date', endDate)

      const logMap = new Map<string, string>()
      ;(attLogs ?? []).forEach((l) => {
        logMap.set(`${l.staff_id}_${l.date}`, l.notes || 'Pagi')
      })

      const items: ShiftRosterItem[] = []
      const start = new Date(startDate)
      const end = new Date(endDate)

      for (const s of staffList) {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          const savedShift = logMap.get(`${s.id}_${dateStr}`) as ShiftType || 'Pagi'

          items.push({
            id: `${s.id}_${dateStr}`,
            staff_id: s.id,
            outlet_id: outletId,
            date: dateStr,
            shift: savedShift,
            outlet_staff: { name: s.name, role: s.role },
          })
        }
      }

      return items
    },
  })

  const setShift = useMutation({
    mutationFn: async ({
      staff_id,
      date,
      shift,
    }: {
      staff_id: string
      date: string
      shift: ShiftType
    }) => {
      // Upsert into attendance_logs notes or roster
      const { data: existing } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('staff_id', staff_id)
        .eq('date', date)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('attendance_logs')
          .update({ notes: shift })
          .eq('id', existing.id)
      } else {
        await supabase.from('attendance_logs').insert({
          staff_id,
          outlet_id: outletId,
          date,
          status: shift === 'Off' ? 'libur' : 'hadir',
          notes: shift,
          late_minutes: 0,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] })
    },
  })

  return { ...query, setShift }
}
