import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DisciplineRecord } from '@/lib/types'
import { isTestOrDevStaff } from '@/lib/staffFilters'

export function useDiscipline() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['discipline'],
    queryFn: async (): Promise<DisciplineRecord[]> => {
      const { data, error } = await supabase
        .from('discipline_records')
        .select('*, outlet_staff(name, role, outlets(name))')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('discipline_records query failed, returning fallback empty list:', error.message)
        return []
      }

      return ((data || []) as DisciplineRecord[]).filter((r) => !isTestOrDevStaff(r.outlet_staff))
    },
  })

  const issueWarning = useMutation({
    mutationFn: async (record: Omit<DisciplineRecord, 'id'>) => {
      const { data, error } = await supabase
        .from('discipline_records')
        .insert(record)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipline'] })
      qc.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  const resolveWarning = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('discipline_records')
        .update({ status: 'resolved' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discipline'] })
      qc.invalidateQueries({ queryKey: ['hr-activity'] })
    },
  })

  return {
    ...query,
    issueWarning,
    resolveWarning,
  }
}
