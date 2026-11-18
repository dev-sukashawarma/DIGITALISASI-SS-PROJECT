'use client'

import { unggahDenganSesi } from '@suka/auth'
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { AlasanRetur, CaraPenyelesaian, StatusRetur } from '@/lib/returVendor/aturan'

const KUNCI = ['retur-vendor'] as const

export interface ReturVendorItem {
  id: string
  bahan_baku_id: string
  purchase_order_item_id: string
  qty: number
  harga: number
  subtotal: number
  alasan: AlasanRetur
  catatan: string | null
  qty_pengganti_diterima: number
  bahan_nama: string
  satuan: string | null
  nomor_po: string | null
  purchase_order_id: string | null
}

export interface ReturVendor {
  id: string
  nomor: string
  supplier_id: string
  supplier_nama: string
  status: StatusRetur
  alasan: AlasanRetur
  catatan: string | null
  bukti_urls: string[]
  diajukan_oleh: string | null
  diajukan_at: string
  diputuskan_at: string | null
  alasan_tolak: string | null
  dibatalkan_at: string | null
  alasan_batal: string | null
  diserahkan_at: string | null
  penerima_vendor: string | null
  bukti_serah_url: string | null
  cara_penyelesaian: CaraPenyelesaian | null
  catatan_penyelesaian: string | null
  bukti_vendor_url: string | null
  uang_dijanjikan: number | null
  uang_diterima: number | null
  nilai_tidak_dikompensasi: number
  alasan_tutup_sisa: string | null
  selesai_at: string | null
  total: number
  items: ReturVendorItem[]
}

const SELECT_RETUR = `id, nomor, supplier_id, status, alasan, catatan, bukti_urls, diajukan_oleh, diajukan_at,
  diputuskan_at, alasan_tolak, dibatalkan_at, alasan_batal, diserahkan_at, penerima_vendor, bukti_serah_url,
  cara_penyelesaian, catatan_penyelesaian, bukti_vendor_url, uang_dijanjikan, uang_diterima,
  nilai_tidak_dikompensasi, alasan_tutup_sisa, selesai_at,
  supplier:supplier_id(nama),
  retur_vendor_item(id, bahan_baku_id, purchase_order_item_id, qty, harga, subtotal, alasan, catatan,
    qty_pengganti_diterima, bahan:bahan_baku_id(nama, satuan),
    poi:purchase_order_item_id(purchase_order_id, po:purchase_order_id(nomor_po)))`

type Mentah = Record<string, unknown> & {
  supplier?: { nama?: string } | null
  retur_vendor_item?: Array<Record<string, unknown> & {
    bahan?: { nama?: string; satuan?: string | null } | null
    poi?: { purchase_order_id?: string; po?: { nomor_po?: string } | null } | null
  }>
}

function petakan(r: Mentah): ReturVendor {
  const items: ReturVendorItem[] = (r.retur_vendor_item ?? []).map((i) => ({
    id: String(i.id),
    bahan_baku_id: String(i.bahan_baku_id),
    purchase_order_item_id: String(i.purchase_order_item_id),
    qty: Number(i.qty) || 0,
    harga: Number(i.harga) || 0,
    subtotal: Number(i.subtotal) || 0,
    alasan: i.alasan as AlasanRetur,
    catatan: (i.catatan as string | null) ?? null,
    qty_pengganti_diterima: Number(i.qty_pengganti_diterima) || 0,
    bahan_nama: i.bahan?.nama ?? '-',
    satuan: i.bahan?.satuan ?? null,
    nomor_po: i.poi?.po?.nomor_po ?? null,
    purchase_order_id: i.poi?.purchase_order_id ?? null,
  }))
  const num = (v: unknown) => (v == null ? null : Number(v))
  return {
    ...(r as unknown as ReturVendor),
    supplier_nama: r.supplier?.nama ?? '-',
    bukti_urls: (r.bukti_urls as string[] | null) ?? [],
    uang_dijanjikan: num(r.uang_dijanjikan),
    uang_diterima: num(r.uang_diterima),
    nilai_tidak_dikompensasi: Number(r.nilai_tidak_dikompensasi) || 0,
    items,
    total: items.reduce((s, i) => s + i.subtotal, 0),
  }
}

export function useDaftarReturVendor(filter: { status?: StatusRetur[]; supplierId?: string } = {}, enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<ReturVendor[]>({
    queryKey: [...KUNCI, 'daftar', filter],
    enabled,
    queryFn: async () => {
      let q = supabase.from('retur_vendor').select(SELECT_RETUR).order('diajukan_at', { ascending: true }).limit(500)
      if (filter.status?.length) q = q.in('status', filter.status)
      if (filter.supplierId) q = q.eq('supplier_id', filter.supplierId)
      const { data, error } = await q
      if (error) throw error
      return ((data ?? []) as unknown as Mentah[]).map(petakan)
    },
  })
}

export function useDetailReturVendor(id: string | null) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<ReturVendor | null>({
    queryKey: [...KUNCI, 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('retur_vendor').select(SELECT_RETUR).eq('id', id!).maybeSingle()
      if (error) throw error
      return data ? petakan(data as unknown as Mentah) : null
    },
  })
}

/** Retur yang terkait satu PO (detail PO). */
export function useReturUntukPo(poId: string | null) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<{ id: string; nomor: string; status: StatusRetur }[]>({
    queryKey: [...KUNCI, 'po', poId],
    enabled: Boolean(poId),
    queryFn: async () => {
      const { data: items, error } = await supabase
        .from('purchase_order_item')
        .select('id')
        .eq('purchase_order_id', poId!)
      if (error) throw error
      const ids = (items ?? []).map((i) => i.id as string)
      if (ids.length === 0) return []
      const { data, error: e2 } = await supabase
        .from('retur_vendor_item')
        .select('retur:retur_vendor_id(id, nomor, status)')
        .in('purchase_order_item_id', ids)
      if (e2) throw e2
      const peta = new Map<string, { id: string; nomor: string; status: StatusRetur }>()
      for (const r of (data ?? []) as unknown as { retur: { id: string; nomor: string; status: StatusRetur } | null }[]) {
        if (r.retur) peta.set(r.retur.id, r.retur)
      }
      return [...peta.values()]
    },
  })
}

export interface ItemPoBisaDiretur {
  purchase_order_item_id: string
  purchase_order_id: string
  nomor_po: string
  tanggal_terima: string | null
  bahan_baku_id: string
  bahan_nama: string
  satuan: string | null
  qty_terima: number
  harga: number
  qty_retur_aktif: number
}

export interface VendorPilihan {
  id: string
  nama: string
  induk: string
}

/** Daftar vendor (supplier) beserta vendor induknya. */
export function useVendorRetur(enabled = true) {
  const supabase = useMemo(() => createClient(), [])
  return useQuery<VendorPilihan[]>({
    queryKey: [...KUNCI, 'vendor'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('supplier').select('id, nama, vendor_induk_id').order('nama')
      if (error) throw error
      return ((data ?? []) as { id: string; nama: string; vendor_induk_id: string | null }[]).map((s) => ({
        id: s.id,
        nama: s.nama,
        induk: s.vendor_induk_id ?? s.id,
      }))
    },
  })
}

/** Barang PO dari vendor induk yang sama dengan supplierId, yang sudah diterima. */
export function useItemPoBisaDiretur(supplierId: string | null, vendor: VendorPilihan[]) {
  const supabase = useMemo(() => createClient(), [])
  const induk = vendor.find((v) => v.id === supplierId)?.induk ?? null
  const supplierIds = induk ? vendor.filter((v) => v.induk === induk).map((v) => v.id) : []
  return useQuery<ItemPoBisaDiretur[]>({
    queryKey: [...KUNCI, 'item-po', induk, supplierIds.join(',')],
    enabled: Boolean(induk) && supplierIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order')
        .select(
          'id, nomor_po, diverifikasi_at, purchase_order_item(id, bahan_baku_id, qty_terima, harga_terima, harga_pesan, bahan:bahan_baku_id(nama, satuan))',
        )
        .in('supplier_id', supplierIds)
        .in('status', ['sebagian_diterima', 'diterima_lengkap'])
        .order('diverifikasi_at', { ascending: false })
        .limit(200)
      if (error) throw error
      type Po = {
        id: string
        nomor_po: string
        diverifikasi_at: string | null
        purchase_order_item: Array<{
          id: string
          bahan_baku_id: string | null
          qty_terima: number | null
          harga_terima: number | null
          harga_pesan: number | null
          bahan: { nama: string; satuan: string | null } | null
        }>
      }
      const items: ItemPoBisaDiretur[] = []
      for (const po of (data ?? []) as unknown as Po[]) {
        for (const i of po.purchase_order_item ?? []) {
          if (!i.bahan_baku_id || !(Number(i.qty_terima) > 0)) continue
          items.push({
            purchase_order_item_id: i.id,
            purchase_order_id: po.id,
            nomor_po: po.nomor_po,
            tanggal_terima: po.diverifikasi_at,
            bahan_baku_id: i.bahan_baku_id,
            bahan_nama: i.bahan?.nama ?? '-',
            satuan: i.bahan?.satuan ?? null,
            qty_terima: Number(i.qty_terima) || 0,
            harga: Number(i.harga_terima ?? i.harga_pesan) || 0,
            qty_retur_aktif: 0,
          })
        }
      }
      if (items.length === 0) return items
      const { data: aktif, error: e2 } = await supabase
        .from('retur_vendor_item')
        .select('purchase_order_item_id, qty, retur:retur_vendor_id(status)')
        .in('purchase_order_item_id', items.map((i) => i.purchase_order_item_id))
      if (e2) throw e2
      const jumlah = new Map<string, number>()
      for (const r of (aktif ?? []) as unknown as { purchase_order_item_id: string; qty: number; retur: { status: string } | null }[]) {
        if (!r.retur || r.retur.status === 'ditolak' || r.retur.status === 'dibatalkan') continue
        jumlah.set(r.purchase_order_item_id, (jumlah.get(r.purchase_order_item_id) ?? 0) + (Number(r.qty) || 0))
      }
      return items.map((i) => ({ ...i, qty_retur_aktif: jumlah.get(i.purchase_order_item_id) ?? 0 }))
    },
  })
}

async function unggah(supabase: ReturnType<typeof createClient>, file: File, folder: string) {
  const { path } = await unggahDenganSesi({ supabase, bucket: 'finance-proofs', folder, file })
  return path
}

function useSegarkan() {
  const qc = useQueryClient()
  return () => {
    for (const queryKey of [KUNCI, ['approval_log'], ['po_payable'], ['cash_balance'], ['cash_transaction'], ['mutasi_rekening']]) {
      qc.invalidateQueries({ queryKey })
    }
  }
}

function lempar(error: unknown) {
  if (error) throw error
}

/** Semua aksi retur vendor (masing-masing satu RPC). Galat RPC dilempar apa adanya. */
export function useMutasiReturVendor() {
  const supabase = useMemo(() => createClient(), [])
  const onSettled = useSegarkan()

  const ajukan = useMutation({
    mutationFn: async (v: {
      supplierId: string
      alasan: AlasanRetur
      catatan: string
      bukti: File[]
      items: { purchase_order_item_id: string; qty: number; alasan: AlasanRetur; catatan?: string }[]
    }) => {
      const urls: string[] = []
      for (const f of v.bukti) urls.push(await unggah(supabase, f, 'retur-vendor'))
      const { data, error } = await supabase.rpc('ajukan_retur_vendor', {
        p_supplier_id: v.supplierId,
        p_alasan: v.alasan,
        p_catatan: v.catatan.trim() || null,
        p_bukti_urls: urls,
        p_items: v.items,
      })
      lempar(error)
      return data as string
    },
    onSettled,
  })

  const putuskan = useMutation({
    mutationFn: async (v: { id: string; setuju: boolean; alasan?: string }) => {
      const { error } = await supabase.rpc('putuskan_retur_vendor', {
        p_id: v.id,
        p_setuju: v.setuju,
        p_alasan: v.alasan?.trim() || null,
      })
      lempar(error)
    },
    onSettled,
  })

  const batalkan = useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('batalkan_retur_vendor', { p_id: v.id, p_alasan: v.alasan.trim() })
      lempar(error)
    },
    onSettled,
  })

  const serahkan = useMutation({
    mutationFn: async (v: { id: string; penerima: string; bukti: File }) => {
      const url = await unggah(supabase, v.bukti, 'retur-vendor')
      const { error } = await supabase.rpc('serahkan_retur_vendor', {
        p_id: v.id,
        p_penerima_vendor: v.penerima.trim() || null,
        p_bukti_url: url,
      })
      lempar(error)
    },
    onSettled,
  })

  const catatPenyelesaian = useMutation({
    mutationFn: async (v: { id: string; cara: CaraPenyelesaian; catatan: string; bukti: File | null; uangDijanjikan?: number }) => {
      const url = v.bukti ? await unggah(supabase, v.bukti, 'retur-vendor') : null
      const { error } = await supabase.rpc('catat_penyelesaian_retur_vendor', {
        p_id: v.id,
        p_cara: v.cara,
        p_catatan: v.catatan.trim() || null,
        p_bukti_vendor_url: url,
        p_uang_dijanjikan: v.cara === 'uang_kembali' ? v.uangDijanjikan ?? null : null,
      })
      lempar(error)
    },
    onSettled,
  })

  const konfirmasiUang = useMutation({
    mutationFn: async (v: { id: string; cashLocationId: string; jumlah: number; bukti: File; catatan: string }) => {
      const url = await unggah(supabase, v.bukti, 'retur-vendor')
      const { error } = await supabase.rpc('konfirmasi_uang_retur_vendor', {
        p_id: v.id,
        p_cash_location_id: v.cashLocationId,
        p_jumlah: v.jumlah,
        p_bukti_url: url,
        p_catatan: v.catatan.trim() || null,
      })
      lempar(error)
    },
    onSettled,
  })

  const terimaPengganti = useMutation({
    mutationFn: async (v: { id: string; items: { retur_vendor_item_id: string; qty: number }[] }) => {
      const { error } = await supabase.rpc('terima_pengganti_retur_vendor', { p_id: v.id, p_items: v.items })
      lempar(error)
    },
    onSettled,
  })

  const tutupSisa = useMutation({
    mutationFn: async (v: { id: string; alasan: string }) => {
      const { error } = await supabase.rpc('tutup_sisa_retur_vendor', { p_id: v.id, p_alasan: v.alasan.trim() })
      lempar(error)
    },
    onSettled,
  })

  return { ajukan, putuskan, batalkan, serahkan, catatPenyelesaian, konfirmasiUang, terimaPengganti, tutupSisa }
}

/** Retur yang menunggu keputusan finance (untuk Hub Approval). */
export function useReturVendorMenunggu(enabled: boolean) {
  return useDaftarReturVendor({ status: ['diajukan'] }, enabled)
}
