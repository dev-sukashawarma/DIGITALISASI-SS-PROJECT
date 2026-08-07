import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@supabase/ssr'

export function usePettyCashTopups(filter?: { from: string; to: string; outletId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return useQuery({
    queryKey: ['petty_cash_topups', filter],
    queryFn: async () => {
      let q = supabase
        .from('petty_cash_topups')
        .select(`
          id, created_at, outlet_id, amount, proof_url, status, transfer_date, 
          outlets ( name )
        `)
        .eq('status', 'disbursed') // only show successful topups as incoming cash

      if (filter) {
        if (filter.outletId !== 'all') {
          q = q.eq('outlet_id', filter.outletId)
        }
        if (filter.from) {
          q = q.gte('transfer_date', filter.from)
        }
        if (filter.to) {
          q = q.lte('transfer_date', filter.to)
        }
      }

      const { data, error } = await q
      if (error) throw error
      
      return (data || []).map(row => ({
        ...row,
        outlet_name: row.outlets?.name
      }))
    }
  })
}
