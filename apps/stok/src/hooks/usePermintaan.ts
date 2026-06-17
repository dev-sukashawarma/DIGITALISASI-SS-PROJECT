'use client'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@suka/auth'
import { createClient } from '@/lib/supabase'
import type { PermintaanWithItems, BuatPermintaanItemInput, ApproveItemInput } from '@/types/permintaan'

// Helper: ambil access_token secara live (bukan dari React state yg mungkin belum ready)
async function getLiveToken(): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sesi tidak ditemukan. Silakan login ulang.')
  return session.access_token
}

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

interface LoadFilter {
  outletId?: string
  pendingOnly?: boolean
}

// ---------------------------------------------------------------------------
// Helper: shared fetch logic
// ---------------------------------------------------------------------------

async function loadPermintaan(filter: LoadFilter): Promise<PermintaanWithItems[]> {
  const supabase = createClient()

  let query = supabase
    .from('permintaan_bahan')
    .select('*, permintaan_bahan_item(*, bahan_baku(nama)), outlets(name)')
    .order('created_at', { ascending: false })

  if (filter.outletId) {
    query = query.eq('outlet_id', filter.outletId)
  }

  if (filter.pendingOnly) {
    query = query.eq('status', 'menunggu')
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => {
    const outlet_name = row.outlets?.name ?? undefined
    const { outlets, permintaan_bahan_item, ...rest } = row
    return {
      ...rest,
      items: (permintaan_bahan_item ?? []).map((it: any) => ({
        ...it,
        nama: it.bahan_baku?.nama ?? it.bahan_baku_id,
      })),
      outlet_name,
    } as PermintaanWithItems
  })
}

// ---------------------------------------------------------------------------
// Hook: useSaranItem
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
        // Filter status di sisi klien — view mengembalikan semua item outlet.
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
// Hook: usePermintaanList
// ---------------------------------------------------------------------------

export function usePermintaanList(outletId: string | undefined) {
  const [permintaan, setPermintaan] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!outletId) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const data = await loadPermintaan({ outletId })
      setPermintaan(data)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [outletId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  // Realtime subscription
  useEffect(() => {
    if (!outletId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`permintaan_list_${outletId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permintaan_bahan',
          filter: `outlet_id=eq.${outletId}`,
        },
        () => {
          refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [outletId, refresh])

  return { permintaan, loading, error, refresh }
}

// ---------------------------------------------------------------------------
// Hook: useApprovalList
// ---------------------------------------------------------------------------

export function useApprovalList() {
  const [permintaan, setPermintaan] = useState<PermintaanWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const data = await loadPermintaan({ pendingOnly: true })
      setPermintaan(data)
    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  return { permintaan, loading, error, refresh }
}

// ---------------------------------------------------------------------------
// Hook: usePermintaanActions
// ---------------------------------------------------------------------------

export function usePermintaanActions() {
  const buat = async (outletId: string, items: BuatPermintaanItemInput[]) => {
    await getLiveToken() // validasi sesi dulu
    const supabase = createClient()
    // eslint-disable-next-line no-console
    console.log('[buat_permintaan] outletId:', outletId, 'items:', items)
    const { error } = await supabase.rpc('buat_permintaan', {
      p_outlet_id: outletId,
      p_items: items,
    })
    // eslint-disable-next-line no-console
    if (error) { console.error('[buat_permintaan] error:', error); throw new Error(error.message) }
  }

  const approve = async (permintaanId: string, items: ApproveItemInput[]) => {
    await getLiveToken()
    const supabase = createClient()
    const { error } = await supabase.rpc('approve_permintaan', {
      p_permintaan_id: permintaanId,
      p_items: items,
    })
    if (error) throw new Error(error.message)
  }

  const tolak = async (permintaanId: string, alasan: string) => {
    await getLiveToken()
    const supabase = createClient()
    const { error } = await supabase.rpc('tolak_permintaan', {
      p_permintaan_id: permintaanId,
      p_alasan: alasan,
    })
    if (error) throw new Error(error.message)
  }

  return { buat, approve, tolak }
}
