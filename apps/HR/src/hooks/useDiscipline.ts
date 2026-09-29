import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { DisciplineRecord } from '@/lib/types'
import { useHrDirectory } from '@/hooks/useHrDirectory'
import { DEFAULT_PAGE_SIZE } from '@/lib/paging'

export type DisciplineFilter = 'all' | 'active' | 'resolved'

export interface DisciplineSummary {
  active: number
  sp1: number
  sp2: number
  sp3: number
  total: number
}

export interface DisciplinePage {
  rows: DisciplineRecord[]
  total: number
  summary: DisciplineSummary
}

/**
 * Satu halaman SP + ringkasan kartu, dihitung di database (RPC hr_sp_daftar).
 * Dulu seluruh riwayat SP ditarik ke browser; error juga ditelan jadi "kosong".
 */
export function useDiscipline(filter: DisciplineFilter = 'all', page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const qc = useQueryClient()
  const { data: dir } = useHrDirectory()

  const query = useQuery<DisciplinePage>({
    queryKey: ['discipline', filter, page, pageSize],
    enabled: !!dir,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hr_sp_daftar', {
        p_filter: filter,
        p_exclude_staff: dir!.excludedStaffIds,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      })
      if (error) throw error
      const res = data as { rows: DisciplineRecord[]; total: number; ringkasan: DisciplineSummary }
      return { rows: res.rows ?? [], total: res.total ?? 0, summary: res.ringkasan }
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['discipline'] })
    qc.invalidateQueries({ queryKey: ['discipline-staff'] })
    qc.invalidateQueries({ queryKey: ['hr-activity'] })
  }

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
    onSuccess: invalidate,
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
    onSuccess: invalidate,
  })

  return {
    ...query,
    isLoading: query.isLoading || !dir,
    issueWarning,
    resolveWarning,
  }
}

/** Riwayat SP satu staf (untuk eskalasi otomatis di form) — dibatasi per staf, pakai index staff_id. */
export function useStaffDiscipline(staffId: string) {
  return useQuery<DisciplineRecord[]>({
    queryKey: ['discipline-staff', staffId],
    enabled: !!staffId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discipline_records')
        .select('*')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as DisciplineRecord[]
    },
  })
}
