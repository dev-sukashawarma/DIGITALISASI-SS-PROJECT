'use client'
import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { LedgerTipe, LedgerTransaksiSummary, LedgerTransaksiDetailRow } from '@/types/stok'

const PAGE_SIZE = 50

export function useLedgerTransaksiList(outletId: string | null | undefined, page = 0) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi', outletId, page],
    queryFn: async () => {
      const supabase = createClient()
      const { data: rows, error: err } = await supabase
        .from('ledger_transaksi_ringkas')
        .select('*')
        .eq('outlet_id', outletId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (err) throw err

      const summaries = (rows as Omit<LedgerTransaksiSummary, 'order_number' | 'order_items_names' | 'opname_tanggal' | 'opname_tipe'>[]) ?? []

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
  return { transaksi: data ?? [], loading: isLoading, error: error ? (error as Error).message : null }
}

export function useLedgerTransaksiDetail(outletId: string | null | undefined, transaksiKey: string | null, enabled: boolean) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ledger-transaksi-detail', outletId, transaksiKey],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('ledger_stok')
        .select('id, tipe, qty, catatan, saldo_sebelum, saldo_sesudah, created_at, bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan)')
        .eq('outlet_id', outletId)
        .or(`ref_order_id.eq.${transaksiKey},ref_opname_id.eq.${transaksiKey},ref_shipment_id.eq.${transaksiKey},ref_transfer_id.eq.${transaksiKey},id.eq.${transaksiKey}`)
        .order('created_at', { ascending: true })
      if (err) throw err
      return (data as unknown as LedgerTransaksiDetailRow[]) ?? []
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
  return { addManual }
}
