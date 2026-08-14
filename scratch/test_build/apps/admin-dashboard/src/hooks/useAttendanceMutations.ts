import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AttendanceStatus } from '@/lib/types'

export interface AttendanceFormValues {
  staff_id: string
  outlet_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  status: AttendanceStatus
  late_minutes: number
  notes: string | null
}

export function useAttendanceMutations() {
  const supabase = createClient()
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['attendance'] })

  const create = useMutation({
    mutationFn: async (values: AttendanceFormValues) => {
      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          staff_id: values.staff_id,
          outlet_id: values.outlet_id,
          date: values.date,
          clock_in: values.clock_in || null,
          clock_out: values.clock_out || null,
          status: values.status,
          late_minutes: values.late_minutes,
          notes: values.notes || null,
        })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async (vars: { id: string } & Partial<AttendanceFormValues>) => {
      const { id, ...rest } = vars
      const { error } = await supabase
        .from('attendance_logs')
        .update(rest)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
