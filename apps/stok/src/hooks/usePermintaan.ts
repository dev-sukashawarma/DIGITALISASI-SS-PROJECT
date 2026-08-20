'use client'
import { useId, useEffect } from 'react'
import { useAuth } from '@suka/auth'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeInvalidate } from '@suka/realtime'
import { createClient } from '@/lib/supabase'
import type { BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'
import {
  fetchPermintaanOutlet,
  fetchPermintaanPending,
  buatPermintaan,
  approvePermintaan,
  tolakPermintaan,
} from '@/app/actions/permintaan'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaranItem {
  bahan_baku_id: string
  item_name: string
  satuan: string
  current_qty: number
  saldo_is_gram: boolean
  threshold: number
  status: 'below' | 'warning'
}

const EMPTY_SARAN: SaranItem[] = []
const EMPTY_PERMINTAAN_OUTLET: Awaited<ReturnType<typeof fetchPermintaanOutlet>> = []
const EMPTY_PERMINTAAN_PENDING: Awaited<ReturnType<typeof fetchPermintaanPending>> = []

// ---------------------------------------------------------------------------
// Hook: useSaranItem — pakai monitoring_view_crew (SECURITY DEFINER, bypass RLS)
// ---------------------------------------------------------------------------

export function useSaranItem(outletId: string | undefined) {
  const { session } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: ['saran_item', outletId],
    queryFn: async () => {
      const supabase = createClient()
      // monitoring_view_crew = SECURITY DEFINER view (bypass RLS stok_balance).
      const { data, error } = await supabase
        .from('monitoring_view_crew')
        .select('bahan_baku_id, item_name, satuan, current_qty, saldo_is_gram, threshold, status')
        .eq('outlet_id', outletId as string)

      if (error) throw error
      return (data ?? [])
        .filter((row: any) => row.status === 'below' || row.status === 'warning')
        .map((row: any): SaranItem => ({
          bahan_baku_id: row.bahan_baku_id,
          item_name: row.item_name,
          satuan: row.satuan,
          current_qty: row.current_qty,
          saldo_is_gram: row.saldo_is_gram,
          threshold: row.threshold,
          status: row.status as 'below' | 'warning',
        }))
    },
    enabled: !!outletId && !!session,
    staleTime: 25000,
    gcTime: 60000,
  })

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[useSaranItem] gagal memload saran:', error)
    }
  }, [error])

  return { saran: data ?? EMPTY_SARAN, loading: isLoading }
}

// ---------------------------------------------------------------------------
// Hook: usePermintaanList — pakai Server Action (bypass refresh-token race)
// ---------------------------------------------------------------------------

export function usePermintaanList(outletId: string | undefined) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permintaan_list', outletId],
    queryFn: () => fetchPermintaanOutlet(outletId as string),
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  // ID unik per instance hook → nama channel realtime tak bentrok bila dua
  // konsumen (PermintaanForm + PermintaanList) memakai outletId yang sama.
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `permintaan_list_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    subs: [
      {
        table: 'permintaan_bahan',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['permintaan_list', outletId]],
      },
    ],
  })

  return {
    permintaan: data ?? EMPTY_PERMINTAAN_OUTLET,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

// ---------------------------------------------------------------------------
// Hook: useApprovalList — pakai Server Action (bypass refresh-token race)
// ---------------------------------------------------------------------------

export function useApprovalList(enabled: boolean = true) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['permintaan_approval'],
    queryFn: () => fetchPermintaanPending(),
    staleTime: 25000,
    gcTime: 60000,
    enabled,
  })

  // Realtime: tak difilter per-outlet karena approver (leader/SPV/kitchen) perlu
  // melihat request dari semua outlet accessible baginya — RLS `permintaan_bahan`
  // (via `accessible_outlet_ids()`) yang membatasi baris mana yang benar-benar
  // terkirim ke client.
  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `permintaan_approval_${instanceId}`,
    enabled,
    subs: [
      {
        table: 'permintaan_bahan',
        queryKeys: [['permintaan_approval']],
      },
    ],
  })

  return {
    permintaan: data ?? EMPTY_PERMINTAAN_PENDING,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refresh: refetch,
  }
}

// ---------------------------------------------------------------------------
// Hook: usePermintaanActions — pakai Server Actions
// ---------------------------------------------------------------------------

export function usePermintaanActions() {
  const buat = async (outletId: string, items: BuatPermintaanItemInput[], targetMetadata?: any) => {
    // eslint-disable-next-line no-console
    console.log('[buat_permintaan] outletId:', outletId, 'items:', items)
    await buatPermintaan(outletId, items, targetMetadata)
    // eslint-disable-next-line no-console
    console.log('[buat_permintaan] SUKSES via server action')
  }

  const approve = async (permintaanId: string, items: ApproveItemInput[]) => {
    await approvePermintaan(permintaanId, items)
  }

  const tolak = async (permintaanId: string, alasan: string) => {
    await tolakPermintaan(permintaanId, alasan)
  }

  return { buat, approve, tolak }
}
