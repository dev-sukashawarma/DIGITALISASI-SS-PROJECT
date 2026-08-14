import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns'

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
        start = startOfMonth(now).toISOString()
        end = endOfMonth(now).toISOString()
      }

      // 1. PR Pending (Not yet PO)
      // Assuming permintaan_pembelian has status like 'approved' or 'pending', etc.
      const { data: prData, error: prError } = await supabase
        .from('permintaan_pembelian')
        .select('id, status')
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', ['pending', 'approved'])

      // 2. PO Pending Approval Finance
      const { data: poApprovalData, error: poAppError } = await supabase
        .from('purchase_orders')
        .select('id, status')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('status', 'pending_approval')

      // 3. PO Approved (Menunggu Penerimaan)
      const { data: poReceiptData, error: poRecError } = await supabase
        .from('purchase_orders')
        .select('id, status')
        .gte('created_at', start)
        .lte('created_at', end)
        .in('status', ['approved', 'partial_receipt'])

      // 4. Invoices Pending/Partial (Hutang)
      // We'll calculate the unpaid ones
      const { data: unpaidPoData, error: unpaidPoError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, supplier_name, total_amount, status, created_at')
        .gte('created_at', start)
        .lte('created_at', end)

      if (prError) throw prError
      if (poAppError) throw poAppError
      if (poRecError) throw poRecError
      if (unpaidPoError) throw unpaidPoError

      const prPendingCount = prData?.length || 0
      const poPendingApprovalCount = poApprovalData?.length || 0
      const poPendingReceiptCount = poReceiptData?.length || 0
      
      let totalUnpaid = 0
      const recentPos = []
      
      unpaidPoData?.forEach(po => {
        if (po.status !== 'paid' && po.status !== 'cancelled' && po.status !== 'draft' && po.status !== 'pending_approval') {
          totalUnpaid += Number(po.total_amount || 0)
        }
        
        // Add to recent if it's not draft/cancelled
        if (po.status !== 'draft' && po.status !== 'cancelled') {
            recentPos.push(po)
        }
      })
      
      // Sort recent descending
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
