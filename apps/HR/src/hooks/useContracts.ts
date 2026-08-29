import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { StaffContract } from '@/lib/types'

export function useContracts(outletFilter?: string) {
  const supabase = createClient()
  const qc = useQueryClient()

  const query = useQuery<StaffContract[]>({
    queryKey: ['contracts', outletFilter],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from('outlet_staff')
        .select(`
          id, name, role, phone, contract_type, join_date, resign_date, status,
          outlets!outlet_staff_outlet_id_fkey(name)
        `)
        .order('name')

      if (outletFilter && outletFilter !== 'all') {
        q = q.eq('outlet_id', outletFilter)
      }

      const { data, error } = await q
      if (error) throw error

      const today = new Date()

      return (data ?? []).map((s: any) => {
        let status: 'active' | 'expiring_soon' | 'expired' | 'renewed' = 'active'
        if (s.resign_date) {
          const end = new Date(s.resign_date)
          const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 0) {
            status = 'expired'
          } else if (diffDays <= 30) {
            status = 'expiring_soon'
          } else {
            status = 'active'
          }
        }

        return {
          id: s.id,
          staff_id: s.id,
          contract_type: s.contract_type === 'permanent' ? 'Tetap' : (s.contract_type?.toUpperCase() || 'PKWT'),
          start_date: s.join_date || s.created_at || new Date().toISOString(),
          end_date: s.resign_date || null,
          status,
          notes: s.status === 'inactive' ? 'Nonaktif' : 'Aktif',
          outlet_staff: {
            name: s.name,
            role: s.role,
            outlets: s.outlets,
            phone: s.phone,
          },
        } as StaffContract
      })
    },
  })

  const updateContract = useMutation({
    mutationFn: async ({
      staff_id,
      contract_type,
      join_date,
      resign_date,
    }: {
      staff_id: string
      contract_type: string
      join_date: string
      resign_date: string | null
    }) => {
      const { error } = await supabase
        .from('outlet_staff')
        .update({
          contract_type,
          join_date,
          resign_date,
        })
        .eq('id', staff_id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  return { ...query, updateContract }
}
