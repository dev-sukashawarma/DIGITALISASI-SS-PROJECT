'use client'
import { useCallback, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { useRealtimeInvalidate } from '@suka/realtime'
import type { LedgerTipe, LedgerTransaksiSummary, LedgerTransaksiDetailRow } from '@/types/stok'

const PAGE_SIZE = 50

export function useLedgerTransaksiList(outletId: string | null | undefined, page = 0) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi', outletId, page],
    queryFn: async () => {
      const supabase = createClient()
      const { data: rows, error: err } = await supabase
        .from('ledger_transaksi_ringkas')
        .select('transaksi_key, outlet_id, created_at, jumlah_bahan, ref_order_id, ref_opname_id, ref_shipment_id, ref_transfer_id, single_bahan_baku_id, single_tipe, single_qty, single_catatan, single_saldo_sesudah')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (err) throw err

      let summaries = (rows as Omit<LedgerTransaksiSummary, 'order_number' | 'order_items_names' | 'opname_tanggal' | 'opname_tipe'>[]) ?? []

      if (page === 0) {
        const { data: pendingWastes, error: wasteErr } = await supabase
          .from('stok_waste_reports')
          .select('id, created_at, bahan_baku_id, qty, reason')
          .eq('outlet_id', outletId)
          .eq('status', 'PENDING')
        
        if (!wasteErr && pendingWastes && pendingWastes.length > 0) {
          const wasteSummaries = pendingWastes.map(w => ({
            transaksi_key: `waste_pending_${w.id}`,
            outlet_id: outletId!,
            created_at: w.created_at,
            jumlah_bahan: 1,
            ref_order_id: null,
            ref_opname_id: null,
            ref_shipment_id: null,
            ref_transfer_id: null,
            single_bahan_baku_id: w.bahan_baku_id,
            single_tipe: 'waste_pending' as const,
            single_qty: -w.qty,
            single_catatan: w.reason,
            single_saldo_sesudah: null,
          }))
          summaries = [...wasteSummaries, ...summaries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
      }

      const orderIds = [...new Set(summaries.map((s) => s.ref_order_id).filter((v): v is string => !!v))]
      const opnameIds = [...new Set(summaries.map((s) => s.ref_opname_id).filter((v): v is string => !!v))]

      const [ordersRes, opnameRes] = await Promise.all([
        orderIds.length
          ? supabase.from('orders').select('id, order_number, order_items(menu_item_name)').in('id', orderIds)
          : Promise.resolve({ data: [] as { id: string; order_number: number; order_items: { menu_item_name: string }[] }[] }),
        opnameIds.length
          ? supabase.from('opname').select('id, tanggal, tipe').in('id', opnameIds)
          : Promise.resolve({ data: [] as { id: string; tanggal: string; tipe: string }[] }),
      ])

      const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, {
        order_number: o.order_number,
        items_names: (o as any).order_items?.map((i: any) => i.menu_item_name).join(', ') ?? null
      }]))
      const opnameMap = new Map((opnameRes.data ?? []).map((o) => [o.id, o]))

      return summaries.map((s) => ({
        ...s,
        order_number: s.ref_order_id ? orderMap.get(s.ref_order_id)?.order_number ?? null : null,
        order_items_names: s.ref_order_id ? orderMap.get(s.ref_order_id)?.items_names ?? null : null,
        opname_tanggal: s.ref_opname_id ? opnameMap.get(s.ref_opname_id)?.tanggal ?? null : null,
        opname_tipe: s.ref_opname_id ? (opnameMap.get(s.ref_opname_id)?.tipe as LedgerTransaksiSummary['opname_tipe']) ?? null : null,
      }))
    },
    enabled: !!outletId,
    staleTime: 25000,
    gcTime: 60000,
  })

  const instanceId = useId()
  useRealtimeInvalidate({
    channelName: `ledger_transaksi_${outletId ?? 'none'}_${instanceId}`,
    enabled: !!outletId,
    debounceMs: 800,
    subs: [
      {
        table: 'ledger_stok',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['ledger-transaksi', outletId], ['ledger-transaksi-detail', outletId]],
      },
      {
        table: 'stok_waste_reports',
        filter: outletId ? `outlet_id=eq.${outletId}` : undefined,
        queryKeys: [['ledger-transaksi', outletId]],
      },
    ],
  })

  return { transaksi: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export function useLedgerTransaksiDetail(outletId: string | null | undefined, transaksiKey: string | null, enabled: boolean) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi-detail', outletId, transaksiKey],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('ledger_stok')
        .select('id, tipe, qty, catatan, saldo_sebelum, saldo_sesudah, created_at, bahan_baku_id, bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan)')
        .eq('outlet_id', outletId)
        .or(`ref_order_id.eq.${transaksiKey},ref_opname_id.eq.${transaksiKey},ref_shipment_id.eq.${transaksiKey},ref_transfer_id.eq.${transaksiKey},id.eq.${transaksiKey}`)
        .order('created_at', { ascending: true })
      if (err) throw err
      const rows = (data as unknown as LedgerTransaksiDetailRow[]) ?? []
      if (rows.length === 0) return rows

      // saldo_is_gram = computed column di stok_balance (per outlet+bahan SAAT
      // INI), tidak tersedia langsung di ledger_stok -- perlu lookup terpisah
      // supaya delta/saldo di layar ini tak lagi salah dikonversi (lihat
      // memory ledger-writers-scale-blind-to-saldo-is-gram).
      const bahanIds = [...new Set(rows.map(r => r.bahan_baku_id))]
      const { data: balances } = await supabase
        .from('stok_balance')
        .select('bahan_baku_id, saldo_is_gram')
        .eq('outlet_id', outletId)
        .in('bahan_baku_id', bahanIds)
      const gramMap = new Map((balances ?? []).map((b: any) => [b.bahan_baku_id, b.saldo_is_gram]))

      return rows.map(r => ({ ...r, saldo_is_gram: gramMap.get(r.bahan_baku_id) ?? false }))
    },
    enabled: enabled && !!outletId && !!transaksiKey,
    staleTime: 60000,
    gcTime: 5 * 60000,
  })
  return { rows: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export interface ManualEntryInput {
  outletId: string; bahanBakuId: string; tipe: Extract<LedgerTipe,'waste'|'adjustment'|'transfer_keluar'>
  qtyAbs: number; catatan: string; createdBy: string
}

export interface ManualEntryBatchItem {
  bahanBakuId: string
  tipe: Extract<LedgerTipe, 'waste' | 'adjustment' | 'transfer_keluar'>
  qtyAbs: number
  catatan?: string
  signedOverride?: number
}

export function useLedgerActions() {
  const supabase = createClient()
  const addManual = useCallback(async (input: ManualEntryInput, signedOverride?: number) => {
    const qty = signedOverride ?? (input.tipe === 'adjustment' ? input.qtyAbs : -Math.abs(input.qtyAbs))
    const { error } = await supabase.from('ledger_stok').insert({
      outlet_id: input.outletId, bahan_baku_id: input.bahanBakuId,
      tipe: input.tipe, qty, catatan: input.catatan, created_by: input.createdBy,
    })
    if (error) throw new Error(error.message)
  }, [])

  const addManualBatch = useCallback(async (
    outletId: string,
    createdBy: string,
    catatanGlobal: string,
    items: ManualEntryBatchItem[]
  ) => {
    const records = items.map(item => {
      const qty = item.signedOverride ?? (item.tipe === 'adjustment' ? item.qtyAbs : -Math.abs(item.qtyAbs))
      return {
        outlet_id: outletId,
        bahan_baku_id: item.bahanBakuId,
        tipe: item.tipe,
        qty,
        catatan: item.catatan || catatanGlobal,
        created_by: createdBy,
      }
    })
    const { error } = await supabase.from('ledger_stok').insert(records)
    if (error) throw new Error(error.message)
  }, [])

  return { addManual, addManualBatch }
}

export function useOrderDetails(orderId: string | null, enabled: boolean) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['order-details', orderId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('order_items')
        .select('id, menu_item_name, quantity')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })
      
      if (err) throw err
      return data ?? []
    },
    enabled: enabled && !!orderId,
    staleTime: 60000,
    gcTime: 5 * 60000,
  })
  return { rows: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}
