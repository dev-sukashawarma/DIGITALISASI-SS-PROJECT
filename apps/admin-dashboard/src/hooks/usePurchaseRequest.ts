import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { toast } from 'sonner'

const supabase = createSupabaseBrowserClient()

export type PurchaseRequest = {
  id: string
  requested_by: string | null
  bahan_baku_id: string | null
  nama_bebas: string | null
  qty: number
  satuan: string | null
  alasan: string | null
  urgensi: 'rendah' | 'normal' | 'mendesak'
  status: 'pending' | 'jadi_po' | 'ditolak'
  linked_po_id: string | null
  created_at: string
}

export function usePurchaseRequests() {
  const q = useQuery<PurchaseRequest[]>({
    queryKey: ['purchase-requests'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_request')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PurchaseRequest[]
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}

export function useRejectPr() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('purchase_request').update({ status: 'ditolak' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests'] }); toast.success('Permintaan ditolak') },
    onError: (e: any) => toast.error(e.message ?? 'Gagal menolak'),
  })
}

export function useConvertPrToPo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, linkedPoId }: { id: string; linkedPoId: string }) => {
      const { error } = await supabase
        .from('purchase_request')
        .update({ status: 'jadi_po', linked_po_id: linkedPoId })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-requests'] }); toast.success('Permintaan dikonversi ke PO') },
    onError: (e: any) => toast.error(e.message ?? 'Gagal mengonversi'),
  })
}
