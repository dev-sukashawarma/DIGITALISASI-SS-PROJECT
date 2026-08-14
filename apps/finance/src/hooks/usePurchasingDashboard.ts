import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { startOfMonth, endOfMonth, parseISO, isValid, format } from 'date-fns'

export interface DashboardFilter {
  startDate: string | null
  endDate: string | null
}

export function usePurchasingDashboard(filter: DashboardFilter) {
  return useQuery({
    queryKey: ['purchasing_dashboard', filter],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient()

      let start = filter.startDate
      let end = filter.endDate

      if (!start || !end || !isValid(parseISO(start)) || !isValid(parseISO(end))) {
        const now = new Date()
        start = format(startOfMonth(now), 'yyyy-MM-dd')
        end = format(endOfMonth(now), 'yyyy-MM-dd')
      } else {
        start = start.split('T')[0]
        end = end.split('T')[0]
      }

      // 1. PR Pending
      const { data: prData, error: prError } = await supabase
        .from('purchase_request')
        .select('id, status')
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59.999Z')
        .eq('status', 'pending')

      if (prError) throw prError

      // 2. All POs within date range via RPC
      const { data: poData, error: poError } = await supabase.rpc('get_purchase_orders', {
        p_from: start,
        p_to: end,
        p_status: null
      })

      if (poError) throw poError

      const prPendingCount = prData?.length || 0
      let poPendingApprovalCount = 0
      let poPendingReceiptCount = 0
      let totalUnpaid = 0
      const recentPos: any[] = []

      let poIds = (poData || []).map((p: any) => p.id)
      let extrasMap = new Map()
      if (poIds.length > 0) {
        const { data: extras } = await supabase
          .from('purchase_order')
          .select('id, payment_status, created_at')
          .in('id', poIds)
        extrasMap = new Map((extras || []).map(x => [x.id, x]))
      }

      (poData || []).forEach((po: any) => {
        const extra = extrasMap.get(po.id)
        const payment_status = extra?.payment_status || 'unpaid'
        
        if (po.status === 'menunggu_approval_finance') {
          poPendingApprovalCount++
        }
        
        if (po.status === 'dikirim_ke_supplier' || po.status === 'sebagian_diterima') {
          poPendingReceiptCount++
        }

        if (po.status !== 'dibatalkan' && po.status !== 'draft' && payment_status !== 'paid') {
           totalUnpaid += Number(po.total_nilai || 0)
        }

        if (po.status !== 'draft' && po.status !== 'dibatalkan') {
          recentPos.push({
            id: po.id,
            po_number: po.nomor_po,
            supplier_name: po.supplier_nama,
            total_amount: po.total_nilai,
            status: po.status,
            created_at: extra?.created_at || po.tanggal_po,
          })
        }
      })

      recentPos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return {
        prPendingCount,
        poPendingApprovalCount,
        poPendingReceiptCount,
        totalUnpaid,
        recentPos: recentPos.slice(0, 5)
      }
    }
  })
}
