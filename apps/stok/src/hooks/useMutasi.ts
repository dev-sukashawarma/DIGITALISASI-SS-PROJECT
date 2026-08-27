'use client'
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import { fetchMutasiList, fetchMutasiById, ajukanMutasi, approveMutasi, kirimMutasi, terimaMutasi } from '@/app/actions/mutasi'

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
