'use client'
import { useId } from 'react'
import { useAuth } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import {
  fetchMutasiList,
  fetchMutasiById,
  fetchPendingMutasiRaw,
  ajukanMutasi,
  approveMutasi,
  kirimMutasi,
  terimaMutasi,
} from '@/app/actions/mutasi'
import {
  calculateMutasiBadgeCounts,
  type MutasiBadgeCounts,
} from '@/lib/stok/mutasiBadge'

const DEFAULT_BADGE_COUNTS: MutasiBadgeCounts = {
  total: 0,
  menungguPersetujuan: 0,
  menungguPengiriman: 0,
  dikirim: 0,
}

// ---------------------------------------------------------------------------
// Hook: useMutasiBadge — realtime notification badge counter
// ---------------------------------------------------------------------------
export function useMutasiBadge(outletId?: string | null) {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role
  const effectiveOutletId = (outletId || outletStaff?.outlet_id) ?? undefined

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mutasi_badge_count', effectiveOutletId, role],
    queryFn: async () => {
      const items = await fetchPendingMutasiRaw(effectiveOutletId)
      return calculateMutasiBadgeCounts(items, role, effectiveOutletId)
    },
    enabled: !!outletStaff,
    staleTime: 20000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `mutasi_badge_${effectiveOutletId ?? 'all'}_${instanceId}`,
    enabled: !!outletStaff,
    subs: [
      {
        table: 'mutasi_antar_outlet',
        queryKeys: [
          ['mutasi_badge_count'],
          ['mutasi_list'],
        ],
      },
    ],
  })

  return {
    badgeCount: data?.total ?? 0,
    counts: data ?? DEFAULT_BADGE_COUNTS,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}


// ---------------------------------------------------------------------------
// Hook: useMutasiList
// ---------------------------------------------------------------------------
export function useMutasiList(outletId?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mutasi_list', outletId],
    queryFn: () => fetchMutasiList(outletId),
    enabled: true, // If we want to allow fetching all mutasi for gudang
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `mutasi_list_${outletId ?? 'all'}_${instanceId}`,
    enabled: true,
    subs: [
      {
        table: 'mutasi_antar_outlet',
        filter: outletId ? `outlet_asal_id=eq.${outletId}` : undefined,
        queryKeys: [['mutasi_list', outletId]],
      },
      {
        table: 'mutasi_antar_outlet',
        filter: outletId ? `outlet_tujuan_id=eq.${outletId}` : undefined,
        queryKeys: [['mutasi_list', outletId]],
      }
    ],
  })

  return {
    mutasi: data ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

// ---------------------------------------------------------------------------
// Hook: useMutasiDetail
// ---------------------------------------------------------------------------
export function useMutasiDetail(mutasiId: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['mutasi_detail', mutasiId],
    queryFn: () => fetchMutasiById(mutasiId),
    enabled: !!mutasiId,
    staleTime: 10000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `mutasi_detail_${mutasiId}_${instanceId}`,
    enabled: !!mutasiId,
    subs: [
      {
        table: 'mutasi_antar_outlet',
        filter: `id=eq.${mutasiId}`,
        queryKeys: [['mutasi_detail', mutasiId]],
      },
      {
        table: 'mutasi_antar_outlet_item',
        filter: `mutasi_id=eq.${mutasiId}`,
        queryKeys: [['mutasi_detail', mutasiId]],
      }
    ],
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

// ---------------------------------------------------------------------------
// Hook: useMutasiActions
// ---------------------------------------------------------------------------
export function useMutasiActions() {
  const ajukan = async (outletAsalId: string, outletTujuanId: string, catatan: string, items: { bahan_baku_id: string, qty_diajukan: number }[]) => {
    return await ajukanMutasi(outletAsalId, outletTujuanId, catatan, items)
  }

  const approve = async (mutasiId: string, isApproved: boolean, catatanPenolakan?: string) => {
    await approveMutasi(mutasiId, isApproved, catatanPenolakan)
  }

  const kirim = async (mutasiId: string, kurirInfo: any, itemsDikirim: { item_id: string, qty_dikirim: number }[]) => {
    await kirimMutasi(mutasiId, kurirInfo, itemsDikirim)
  }

  const terima = async (mutasiId: string, itemsDiterima: { item_id: string, qty_diterima: number, kondisi_diterima: string, foto_bukti_terima?: string }[]) => {
    await terimaMutasi(mutasiId, itemsDiterima)
  }

  return { ajukan, approve, kirim, terima }
}
