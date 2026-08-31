import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'

export function usePettyCashTopups(filter?: { from: string; to: string; outletId: string }) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['petty_cash_topups', filter],
    queryFn: async () => {
      let q = supabase
        .from('petty_cash_topups')
        .select(`
          id, created_at, outlet_id, amount, proof_of_transfer_url, status,
          approved_at, finance_forwarded_at, area_manager_forwarded_at,
          leader_forwarded_at, completed_at,
          outlets ( name )
        `)
        // `disbursed` and `transfer_date` belonged to the old top-up schema.
        // The live workflow records the hand-off in these status/timestamp fields.
        .in('status', [
          'approved_by_finance',
          'forwarded_by_finance',
          'forwarded_by_area_manager',
          'forwarded_by_leader',
          'completed',
        ])

      if (filter) {
        if (filter.outletId !== 'all') {
          q = q.eq('outlet_id', filter.outletId)
        }
      }

      const { data, error } = await q
      if (error) throw error

      return (data || [])
        .map((row: any) => {
          const transferAt = row.completed_at ??
            row.leader_forwarded_at ??
            row.area_manager_forwarded_at ??
            row.finance_forwarded_at ??
            row.approved_at ??
            row.created_at

          return {
            ...row,
            // Keep the report's existing field contract while deriving it from
            // the timestamp that represents the latest effective hand-off.
            transfer_date: transferAt?.slice(0, 10) ?? null,
            outlet_name: row.outlets?.name,
          }
        })
        .filter((row: any) => {
          if (!filter) return true
          if (filter.from && (!row.transfer_date || row.transfer_date < filter.from)) return false
          if (filter.to && (!row.transfer_date || row.transfer_date > filter.to)) return false
          return true
        })
    }
  })
}
