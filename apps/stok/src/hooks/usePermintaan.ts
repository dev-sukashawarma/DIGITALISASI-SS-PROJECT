'use client'
import { useCallback, useEffect, useId, useState } from 'react'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'
import type { PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'
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
  threshold: number
  status: 'below' | 'warning'
}

// ---------------------------------------------------------------------------
// Hook: useSaranItem — pakai monitoring_view_crew (SECURITY DEFINER, bypass RLS)
// ---------------------------------------------------------------------------

export function useSaranItem(outletId: string | undefined) {
  const { session } = useAuth()
  const [saran, setSaran] = useState<SaranItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!outletId || !session) {
      setLoading(false)
      return
    }

    const supabase = createClient()
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        // monitoring_view_crew = SECURITY DEFINER view (bypass RLS stok_balance).
        const { data, error } = await supabase
          .from('monitoring_view_crew')
          .select('bahan_baku_id, item_name, satuan, current_qty, threshold, status')
          .eq('outlet_id', outletId)

        if (error) throw error
        if (!cancelled) {
          setSaran(
            (data ?? [])
              .filter((row: any) => row.status === 'below' || row.status === 'warning')
              .map((row: any) => ({
                bahan_baku_id: row.bahan_baku_id,
                item_name: row.item_name,
                satuan: row.satuan,
                current_qty: row.current_qty,
                threshold: row.threshold,
                status: row.status as 'below' | 'warning',
              }))
          )
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[useSaranItem] gagal memload saran:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [outletId, session])

  return { saran, loading }
}

// ---------------------------------------------------------------------------
// Hook: usePermintaanList — pakai Server Action (bypass refresh-token race)
// ---------------------------------------------------------------------------

export function usePermintaanList(outletId: string | undefined) {
  // ID unik per instance hook → nama channel realtime tak bentrok bila dua
  // konsumen (PermintaanForm + PermintaanList) memakai outletId yang sama.
  // Tanpa ini: dua channel bernama identik → "cannot add postgres_changes
  // callbacks after subscribe()".
  const instanceId = useId()
  const [permintaan, setPermintaan] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!outletId) { setLoading(false); return }
    setError(null)
    try {
      const data = await fetchPermintaanOutlet(outletId)
      setPermintaan(data)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [outletId])

  useEffect(() => { setLoading(true); refresh() }, [refresh])

  // Realtime: tetap pakai client-side subscription tapi trigger server action untuk fetch
  useEffect(() => {
    if (!outletId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`permintaan_list_${outletId}_${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'permintaan_bahan',
        filter: `outlet_id=eq.${outletId}`,
      }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [outletId, refresh, instanceId])

  return { permintaan, loading, error, refresh }
}

// ---------------------------------------------------------------------------
// Hook: useApprovalList — pakai Server Action (bypass refresh-token race)
// ---------------------------------------------------------------------------

export function useApprovalList() {
  const [permintaan, setPermintaan] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchPermintaanPending()
      setPermintaan(data)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { setLoading(true); refresh() }, [refresh])

  // Realtime: tak difilter per-outlet karena approver (leader/SPV/kitchen) perlu
  // melihat request dari semua outlet accessible baginya — RLS `permintaan_bahan`
  // (via `accessible_outlet_ids()`) yang membatasi baris mana yang benar-benar
  // terkirim ke client.
  const instanceId = useId()
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`permintaan_approval_${instanceId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'permintaan_bahan',
      }, () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refresh, instanceId])

  return { permintaan, loading, error, refresh }
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
