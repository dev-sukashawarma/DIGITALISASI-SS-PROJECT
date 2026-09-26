'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchDaftarRetur,
  fetchReturDetail,
  fetchPendingReturForOutlet,
  submitReturClaim,
  approveReturManager,
  konfirmasiSerahTerimaDriver,
  verifikasiKitchenDanBuatSJ,
} from '@/app/actions/retur'
import { useRealtimeInvalidate } from '@suka/realtime'
import { ReturStok } from '@/types/retur'

export function useDaftarRetur(options?: {
  outletId?: string | null
  status?: string | null
  limit?: number
}) {
  const queryKey = ['daftar_retur', options?.outletId ?? 'all', options?.status ?? 'all']

  const { data, isLoading, error, refetch } = useQuery<ReturStok[]>({
    queryKey,
    queryFn: () => fetchDaftarRetur(options),
    staleTime: 20000,
    gcTime: 60000,
  })

  useRealtimeInvalidate({
    channelName: `retur_stok_${options?.outletId ?? 'all'}`,
    subs: [
      {
        table: 'retur_stok',
        event: '*',
        queryKeys: [
          ['daftar_retur'],
          ['retur_pending_badges'],
          ['retur_detail'],
        ],
      },
    ],
  })

  return {
    returs: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

export function useReturDetail(returId: string | null | undefined) {
  return useQuery<ReturStok | null>({
    queryKey: ['retur_detail', returId],
    queryFn: () => (returId ? fetchReturDetail(returId) : Promise.resolve(null)),
    enabled: !!returId,
    staleTime: 15000,
  })
}

/**
 * Hook untuk mengambil daftar tiket retur yang fisik timbangannya sudah di Kitchen
 * tetapi belum dikirim penggantinya untuk suatu outlet.
 */
export function usePendingReturForOutlet(outletId: string | null | undefined) {
  return useQuery({
    queryKey: ['pending_retur_outlet', outletId],
    queryFn: () => (outletId ? fetchPendingReturForOutlet(outletId) : Promise.resolve([])),
    enabled: !!outletId,
    staleTime: 10000,
  })
}

/**
 * Hook untuk badge pending Retur (digunakan di BottomNav & Dashboard).
 */
export function usePendingReturBadge(role: string | undefined, outletId: string | undefined) {
  const isManager = ['area_manager', 'regional_manager', 'admin', 'owner', 'developer'].includes(role ?? '')
  const isKitchen = ['kitchen', 'admin', 'owner', 'purchasing', 'developer'].includes(role ?? '')

  const { data: list = [] } = useQuery<ReturStok[]>({
    queryKey: ['retur_pending_badges', role, outletId],
    queryFn: () => fetchDaftarRetur({ limit: 50 }),
    staleTime: 30000,
  })

  let count = 0
  if (isManager) {
    // Menunggu approval manager
    count = list.filter((r) => r.status === 'diajukan').length
  } else if (isKitchen) {
    // Menunggu verifikasi timbang kitchen
    count = list.filter((r) => r.status === 'dalam_pengiriman' || r.status === 'diterima_kitchen').length
  } else {
    // Untuk kru: tiket outlet sendiri yang aktif
    count = list.filter(
      (r) => r.outlet_id === outletId && r.status !== 'selesai' && r.status !== 'ditolak'
    ).length
  }

  return { badgeCount: count }
}

export function useReturActions() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['daftar_retur'] })
    queryClient.invalidateQueries({ queryKey: ['retur_pending_badges'] })
    queryClient.invalidateQueries({ queryKey: ['retur_detail'] })
    queryClient.invalidateQueries({ queryKey: ['monitoring'] })
    queryClient.invalidateQueries({ queryKey: ['ledger'] })
  }

  const submitClaim = useMutation({
    mutationFn: async (payload: Parameters<typeof submitReturClaim>[0]) => {
      const res = await submitReturClaim(payload)
      if (!res.success) {
        throw new Error(res.error || 'Gagal mengajukan retur bahan')
      }
      return res.data
    },
    onSuccess: invalidate,
  })

  const approveManager = useMutation({
    mutationFn: async ({ returId, approve, note }: { returId: string; approve: boolean; note?: string }) => {
      const res = await approveReturManager(returId, approve, note)
      if (!res.success) {
        throw new Error(res.error || 'Gagal memproses persetujuan manager')
      }
      return res.data
    },
    onSuccess: invalidate,
  })

  const serahTerima = useMutation({
    mutationFn: async (payload: Parameters<typeof konfirmasiSerahTerimaDriver>[0]) => {
      const res = await konfirmasiSerahTerimaDriver(payload)
      if (!res.success) {
        throw new Error(res.error || 'Gagal mengonfirmasi serah terima kurir')
      }
      return res.data
    },
    onSuccess: invalidate,
  })

  const verifikasiKitchen = useMutation({
    mutationFn: async ({
      returId,
      itemsVerified,
      note,
      terbitkanSjSekarang = true,
    }: {
      returId: string
      itemsVerified: Array<{ id: string; qty_diterima_kitchen: number }>
      note?: string
      terbitkanSjSekarang?: boolean
    }) => {
      const res = await verifikasiKitchenDanBuatSJ(returId, itemsVerified, note, terbitkanSjSekarang)
      if (!res.success) {
        throw new Error(res.error || 'Gagal memverifikasi retur Central Kitchen')
      }
      return res.data
    },
    onSuccess: invalidate,
  })

  return {
    submitClaim,
    approveManager,
    serahTerima,
    verifikasiKitchen,
  }
}
