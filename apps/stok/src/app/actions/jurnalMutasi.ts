'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createSupabaseServerClient, getVerifiedUserId } from '@suka/auth'
import { getDistribusiFactor } from '@/lib/format/compositeUnit'
import {
  attributeFifo,
  hargaRataFifo,
  labelFifo,
  nilaiFifoRp,
  type FifoLayerIn,
  type FifoWindowRow,
} from '@/lib/stok/vendorFifo'
import {
  hargaKecilDariNilai,
  hargaKecilWajar,
  nilaiBarisRp,
  nilaiDokumenSuratJalan,
  ringkasItemSuratJalan,
  type ItemSuratJalan,
} from '@/lib/stok/hargaSuratJalan'
import { assertStaffCanAccessOutlet } from '@/lib/stok/outletAccess'
import { canViewJurnalMutasi } from '@/lib/stok/navAccess'
import { isMutasiOrder, pemakaianPosPerBahan } from '@/lib/stok/mutasiOrder'
import { ambilWaktuTutupOpname, pilihWaktuTutupOpname } from '@/lib/stok/waktuTutupOpname'
import {
  BATAS_MUNDUR_BASELINE_HARI,
  batasHariWIB,
  filterOrJendela,
  keMikrodetik,
  pilihOpnameRentang,
  rentangGabungan,
  susunJendelaOutlet,
  type JendelaOutlet,
  type JendelaWaktu,
} from '@/lib/stok/jendelaRentangOpname'
import { cariTukarBahan, isKelipatanKemasan } from '@/lib/stok/diagnosaSelisih'
import { INFLOW_TIPE, klasifikasiMutasi } from '@/lib/stok/klasifikasiMutasi'
import { gabungPosisiOutlet, saldoAwalOutlet, type PosisiOutletBahan } from '@/lib/stok/rekonsiliasiOutlet'
import { serapLapisan, type BarisLapisan } from '@/lib/stok/lapisanAwalFifo'

/** Kunci pasangan (outlet, bahan). UUID tak memuat '|', jadi aman dipisah. */
const kunciOB = (outletId: string, bahanId: string) => `${outletId}|${bahanId}`


function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

/**
 * PostgREST memotong tiap request di max-rows server (1000) TANPA error --
 * query yang melampauinya diam-diam kehilangan sisa barisnya. Ambil per
 * halaman sampai habis. `build` wajib membuat query BARU tiap panggilan dan
 * sudah memuat ORDER BY yang unik (mis. created_at + id): tanpa urutan unik,
 * batas halaman tidak stabil dan baris bisa dobel/terlewat.
 */
async function fetchAllPages<T>(build: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < pageSize) return all
  }
}

async function getAuthedClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (toSet) =>
      toSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options as any)
      ),
  })
}

async function requireManagementAuth(outletId?: string) {
  const authedClient = await getAuthedClient()
  const userId = await getVerifiedUserId(authedClient)
  if (!userId) {
    throw new Error('Unauthorized: Sesi login tidak ditemukan')
  }

  const serviceClient = makeServiceClient()
  const { data: staff, error: staffError } = await serviceClient
    .from('outlet_staff')
    .select('id, role, status, name, outlet_id')
    .eq('id', userId)
    .maybeSingle()

  if (staffError) throw new Error(staffError.message)
  if (!staff || staff.status !== 'active') {
    throw new Error('Unauthorized: Akun staff tidak aktif')
  }

  if (!canViewJurnalMutasi(staff.role)) {
    throw new Error('Forbidden: Laporan ini khusus untuk Manajemen Pusat (Owner, Admin, SPV, RM, Kitchen, Purchasing, Finance, HR)')
  }

  if (outletId && outletId !== 'ALL') {
    await assertStaffCanAccessOutlet(serviceClient, staff.id, outletId)
  }

  return { staff, authedClient, serviceClient }
}

interface VendorRefRow {
  bahan_baku_id: string
  ref_shipment_id: string | null
  ref_terima_vendor_id: string | null
  ref_po_id: string | null
}

const vendorLabel = (nama: string | null | undefined) =>
  nama ? nama.replace(/\s*-\s*Tempo\s*\d+\s*$/i, '').trim() : null

const NON_RETAIL_TYPES = new Set(['test', 'marketplace', 'office', 'gudang', 'warehouse', 'kitchen', 'system'])
const NON_RETAIL_NAME_RE = /(gudang|kantor pusat|backup|\btes\b|\btest\b|trial|demo|global|shopee|tiktok)/i

/**
 * Filter kanonik untuk memastikan konsolidasi "Semua Outlet" hanya menghitung
 * cabang operasional ritel (mengecualikan Gudang Pusat HQ agar inbound tidak dobel,
 * serta mengecualikan outlet tes, backup, kantor pusat, dan akun marketplace).
 */
function isRetailSalesOutlet(outlet: { name: string; type?: string | null }): boolean {
  const t = String(outlet.type || '').trim().toLowerCase()
  if (t && NON_RETAIL_TYPES.has(t)) return false
  if (NON_RETAIL_NAME_RE.test(outlet.name || '')) return false
  return true
}

/** Baris surat_jalan_item per kunci `${surat_jalan_id}_${bahan_baku_id}`. */
async function fetchItemSuratJalan(
  supabase: ReturnType<typeof makeServiceClient>,
  sjIds: string[],
  bahanIds: string[]
): Promise<Map<string, (ItemSuratJalan & { vendor_id: string | null })[]>> {
  const grup = new Map<string, (ItemSuratJalan & { vendor_id: string | null })[]>()
  for (let i = 0; i < sjIds.length; i += 200) {
    try {
      const data = await fetchAllPages<any>(() =>
        supabase
          .from('surat_jalan_item')
          .select('surat_jalan_id, bahan_baku_id, vendor_id, harga_snapshot, qty_dikirim, qty_terima')
          .in('surat_jalan_id', sjIds.slice(i, i + 200))
          .in('bahan_baku_id', bahanIds)
          .order('id', { ascending: true })
      )
      for (const x of data) {
        const k = `${x.surat_jalan_id}_${x.bahan_baku_id}`
        const list = grup.get(k) || []
        list.push({
          vendor: null,
          vendor_id: x.vendor_id ?? null,
          harga_snapshot: x.harga_snapshot === null ? null : Number(x.harga_snapshot),
          qty_dikirim: x.qty_dikirim === null ? null : Number(x.qty_dikirim),
          qty_terima: x.qty_terima === null ? null : Number(x.qty_terima),
        })
        grup.set(k, list)
      }
    } catch (e) {
      console.warn('Gagal memuat item surat jalan:', e)
    }
  }
  return grup
}

/**
 * Nilai dokumen surat jalan (Rp) untuk baris ledger ber-`ref_shipment_id`:
 * qty dokumen x harga_snapshot pada sisi baris itu (keluar/terima/ditolak).
 * Pemanggil membaginya dengan qty satuan kecil baris untuk harga per satuan
 * kecil -- tidak memakai faktor satuan sekarang yang bisa sudah berubah.
 * Tanpa surat jalan / tanpa harga -> null (jatuh ke harga master).
 */
async function resolveNilaiSuratJalan(
  supabase: ReturnType<typeof makeServiceClient>,
  rows: { ref_shipment_id?: string | null; bahan_baku_id: string; tipe?: string }[]
): Promise<(row: { ref_shipment_id?: string | null; bahan_baku_id: string; tipe?: string }) => number | null> {
  const sjIds = [...new Set(rows.map((r) => r.ref_shipment_id).filter((v): v is string => !!v))]
  const bahanIds = [...new Set(rows.map((r) => r.bahan_baku_id))]
  const grup = await fetchItemSuratJalan(supabase, sjIds, bahanIds)
  return (row) => {
    if (!row.ref_shipment_id) return null
    const items = grup.get(`${row.ref_shipment_id}_${row.bahan_baku_id}`)
    return items ? nilaiDokumenSuratJalan(items, row.tipe || 'terima_kiriman') : null
  }
}

/**
 * Vendor hanya diketahui untuk barang MASUK: surat jalan (vendor_id per baris),
 * terima drop-ship, atau PO. Pemakaian di outlet tidak dilacak per vendor.
 * Kunci hasil: `${tipeRef}:${refId}:${bahanId}` -> nama vendor.
 */
async function resolveVendorNames(
  supabase: ReturnType<typeof makeServiceClient>,
  rows: VendorRefRow[]
): Promise<(row: VendorRefRow) => string | null> {
  const sjIds = [...new Set(rows.map((r) => r.ref_shipment_id).filter((v): v is string => !!v))]
  const tvIds = [...new Set(rows.map((r) => r.ref_terima_vendor_id).filter((v): v is string => !!v))]
  const poIds = [...new Set(rows.map((r) => r.ref_po_id).filter((v): v is string => !!v))]

  const fetchInChunks = async (
    table: string,
    selectCols: string,
    filterCol: string,
    ids: string[],
    notNullCol?: string
  ): Promise<any[]> => {
    if (ids.length === 0) return []
    const out: any[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200)
      // 200 surat jalan x ~30 baris bahan bisa > 1000 baris -> berhalaman, urut id.
      try {
        const rows = await fetchAllPages<any>(() => {
          let q = supabase.from(table).select(selectCols).in(filterCol, chunk)
          if (notNullCol) q = q.not(notNullCol, 'is', null)
          return q.order('id', { ascending: true })
        })
        out.push(...rows)
      } catch (e) {
        // Nama vendor hanya label; galat tidak boleh menggagalkan laporan (perilaku lama).
        console.warn(`Gagal memuat ${table} untuk nama vendor:`, e)
      }
    }
    return out
  }

  const [sjData, tvData, poData] = await Promise.all([
    fetchInChunks('surat_jalan_item', 'surat_jalan_id, bahan_baku_id, vendor_id', 'surat_jalan_id', sjIds, 'vendor_id'),
    fetchInChunks('terima_vendor_outlet', 'id, supplier_id', 'id', tvIds),
    fetchInChunks('purchase_order', 'id, supplier_id', 'id', poIds),
  ])

  const supplierIds = [
    ...new Set([
      ...sjData.map((x: any) => x.vendor_id),
      ...tvData.map((x: any) => x.supplier_id),
      ...poData.map((x: any) => x.supplier_id),
    ].filter(Boolean)),
  ]
  const nameById = new Map<string, string>()
  if (supplierIds.length > 0) {
    const { data: sup } = await supabase.from('supplier').select('id, nama').in('id', supplierIds)
    for (const s of sup || []) nameById.set(s.id, vendorLabel(s.nama) || s.nama)
  }

  const sjMap = new Map<string, string>()
  for (const x of sjData) sjMap.set(`${x.surat_jalan_id}_${x.bahan_baku_id}`, x.vendor_id)
  const tvMap = new Map<string, string>(tvData.map((x: any) => [x.id, x.supplier_id]))
  const poMap = new Map<string, string>(poData.map((x: any) => [x.id, x.supplier_id]))

  return (row) => {
    const sid =
      (row.ref_terima_vendor_id && tvMap.get(row.ref_terima_vendor_id)) ||
      (row.ref_po_id && poMap.get(row.ref_po_id)) ||
      (row.ref_shipment_id && sjMap.get(`${row.ref_shipment_id}_${row.bahan_baku_id}`)) ||
      null
    return sid ? nameById.get(sid) || null : null
  }
}

/** Nama item order kadang membawa catatan kasir: "Menu|NOTE|Tidak Pedas" -> "Menu". */
const bersihNamaMenu = (n: string | null | undefined) => (n || '').replace(/\s*\|\s*NOTE\s*\|.*$/i, '').trim()

/** Batas penelusuran lapisan saldo awal FIFO (sebelum periode). */
const PRIOR_INFLOW_LOOKBACK_HARI = 120
const PRIOR_INFLOW_MAX_HALAMAN = 15

/**
 * Kiriman masuk terakhir sebelum periode (terbaru dulu) untuk membentuk lapisan
 * saldo awal FIFO per kunci (`kunci(row)`, mis. outlet|bahan).
 *
 * Dulu: satu kueri `.limit(3000)` -> dipotong PostgREST jadi 1000 baris terbaru
 * lintas semua bahan, sehingga lapisan dibentuk dari data terpotong. Sekarang
 * berhalaman (urut created_at, id menurun) dan berhenti begitu saldo awal tiap
 * kunci tertutup, maksimal PRIOR_INFLOW_LOOKBACK_HARI hari / MAX_HALAMAN
 * halaman. Sisa yang tak tertutup menjadi "Vendor tidak tercatat" (attributeFifo).
 * Nama vendor hanya diselesaikan untuk baris yang benar-benar terpakai.
 */
async function fetchPriorInflows(
  supabase: ReturnType<typeof makeServiceClient>,
  outletId: string | string[],
  /**
   * Awal periode: satu instan untuk semua outlet, atau per outlet (mode Rentang
   * Tanggal: jendela tiap outlet mulai dari waktu tutup opname baseline-nya).
   */
  awal: string | Map<string, string>,
  bahanIds: string[] | null,
  opts: {
    /** Saldo awal (satuan kecil) yang perlu ditutup per kunci. */
    kebutuhan: Map<string, number>
    kunci: (row: any) => string
    /** Normalisasi qty ke satuan kecil (pasangan outlet/bahan berskala besar). */
    normalisasi?: (row: any) => any
  }
): Promise<Map<string, FifoLayerIn[]>> {
  const sisa = new Map<string, number>()
  for (const [k, v] of opts.kebutuhan) if (v > 0.0001) sisa.set(k, v)
  const terpakai = new Map<string, (BarisLapisan & { asal: any })[]>()
  if (sisa.size === 0) return new Map()

  // Per outlet: kueri sampai awal PALING AKHIR, lalu tiap baris disaring terhadap
  // awal jendela outletnya sendiri (baris di dalam jendela bukan "sebelum periode").
  const awalPer = typeof awal === 'string' ? null : awal
  const rentangAwal = awalPer
    ? rentangGabungan([...awalPer.values()].map((s) => ({ start: s, end: s })))
    : { start: awal as string, end: awal as string }
  const startIso = rentangAwal.end
  const sebelumAwal = (r: any) => {
    if (!awalPer) return true
    const a = awalPer.get(r.outlet_id)
    return a === undefined ? false : keMikrodetik(r.created_at) < keMikrodetik(a)
  }

  const batasBawah = new Date(Date.parse(rentangAwal.start) - PRIOR_INFLOW_LOOKBACK_HARI * 86400000).toISOString()
  const PAGE = 1000
  for (let hal = 0; hal < PRIOR_INFLOW_MAX_HALAMAN; hal++) {
    let q = supabase
      .from('ledger_stok')
      .select('id, outlet_id, bahan_baku_id, tipe, qty, created_at, ref_shipment_id, ref_terima_vendor_id, ref_po_id')
      .lt('created_at', startIso)
      .gte('created_at', batasBawah)
      .gt('qty', 0)
      .in('tipe', INFLOW_TIPE)
    q = Array.isArray(outletId) ? q.in('outlet_id', outletId) : q.eq('outlet_id', outletId)
    if (bahanIds) q = q.in('bahan_baku_id', bahanIds)
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(hal * PAGE, hal * PAGE + PAGE - 1)
    if (error) {
      console.warn('Gagal memuat lapisan saldo awal FIFO:', error)
      break
    }
    const rows = (data || []) as any[]
    const baris = rows.filter(sebelumAwal).map((r) => {
      const n = opts.normalisasi ? opts.normalisasi(r) : r
      return { kunci: opts.kunci(n), qty: Number(n.qty), vendor: null as string | null, asal: r }
    })
    const cukup = serapLapisan(sisa, baris, terpakai)
    if (cukup || rows.length < PAGE) break
  }

  const dipakai = [...terpakai.values()].flat()
  const [vendorOf, nilaiOf] = await Promise.all([
    resolveVendorNames(supabase, dipakai.map((b) => b.asal)),
    resolveNilaiSuratJalan(supabase, dipakai.map((b) => b.asal)),
  ])
  const out = new Map<string, FifoLayerIn[]>()
  for (const [k, list] of terpakai) {
    out.set(
      k,
      // b.qty sudah satuan kecil (dinormalisasi) -> harga per satuan kecil dari nilai dokumen.
      list.map((b) => ({ qty: b.qty, vendor: vendorOf(b.asal), harga: hargaKecilDariNilai(nilaiOf(b.asal), b.qty) }))
    )
  }
  return out
}

/**
 * Petakan baris pemakaian ke menu yang terjual (order_items + resep/paket), tanpa catatan ledger.
 * Hasil: ledgerId -> "Nama Menu" (atau "Paket > Komponen"), diberi "xN" bila porsi > 1.
 */
async function resolveMenuTerjual(
  supabase: ReturnType<typeof makeServiceClient>,
  outletId: string,
  bahanBakuId: string,
  rows: { id: string; tipe: string; qty: number; ref_order_id: string | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const pakaiRows = rows.filter((r) => r.tipe === 'pemakaian' && r.ref_order_id)
  const orderIds = [...new Set(pakaiRows.map((r) => r.ref_order_id as string))]
  if (orderIds.length === 0) return out

  const items: { order_id: string; menu_item_id: string; menu_item_name: string | null; quantity: number }[] = []
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200)
    // 200 order bisa > 1000 item (paket/order besar) -> berhalaman, urut id.
    try {
      const rows = await fetchAllPages<any>(() =>
        supabase
          .from('order_items')
          .select('order_id, menu_item_id, menu_item_name, quantity')
          .in('order_id', chunk)
          .not('menu_item_id', 'is', null)
          .order('id', { ascending: true })
      )
      items.push(...rows)
    } catch (e) {
      console.warn('Gagal memuat item order untuk label menu:', e)
    }
  }
  const menuIds = [...new Set(items.map((i) => String(i.menu_item_id)))]
  if (menuIds.length === 0) return out

  const { data: pkgs } = await supabase
    .from('menu_packages')
    .select('package_id, menu_item_id, quantity')
    .in('package_id', menuIds)
  const compIds = [...new Set((pkgs || []).map((p: any) => String(p.menu_item_id)))]
  const allIds = [...new Set([...menuIds, ...compIds])]

  const [resepRes, namesRes] = await Promise.all([
    supabase
      .from('resep')
      .select('menu_item_ref, scope, outlet_id, resep_item!inner(bahan_baku_id, qty_per_porsi)')
      .in('menu_item_ref', allIds)
      .eq('is_active', true)
      .eq('resep_item.bahan_baku_id', bahanBakuId),
    compIds.length > 0
      ? supabase.from('menu_items').select('id, name').in('id', compIds)
      : Promise.resolve({ data: [] as any[] }),
  ])

  // qty bahan per 1 porsi menu; resep outlet menimpa global
  const qppByMenu = new Map<string, { qpp: number; scope: string }>()
  for (const r of (resepRes.data || []) as any[]) {
    if (outletId !== 'ALL' && r.scope === 'outlet' && r.outlet_id !== outletId) continue
    const qpp = Number(r.resep_item?.[0]?.qty_per_porsi || 0)
    const cur = qppByMenu.get(r.menu_item_ref)
    if (!cur || (cur.scope === 'global' && r.scope === 'outlet')) qppByMenu.set(r.menu_item_ref, { qpp, scope: r.scope })
  }
  const compName = new Map<string, string>((namesRes.data || []).map((m: any) => [m.id, m.name]))
  const pkgOf = new Map<string, { menu_item_id: string; quantity: number }[]>()
  for (const p of (pkgs || []) as any[]) {
    const l = pkgOf.get(p.package_id) || []
    l.push({ menu_item_id: String(p.menu_item_id), quantity: Number(p.quantity || 1) })
    pkgOf.set(p.package_id, l)
  }

  // kandidat per order: menu yang benar-benar memakai bahan ini
  const kandidat = new Map<string, { label: string; expected: number }[]>()
  for (const it of items) {
    const mid = String(it.menu_item_id)
    const porsi = Number(it.quantity || 1)
    const nama = bersihNamaMenu(it.menu_item_name) || `Menu #${mid.slice(0, 8)}`
    const list = kandidat.get(it.order_id) || []
    const comps = pkgOf.get(mid)
    if (comps && comps.length > 0) {
      for (const c of comps) {
        const r = qppByMenu.get(c.menu_item_id)
        if (!r) continue
        list.push({
          label: `${nama} > ${compName.get(c.menu_item_id) || 'komponen'}${porsi > 1 ? ` x${porsi}` : ''}`,
          expected: r.qpp * c.quantity * porsi,
        })
      }
    } else {
      const r = qppByMenu.get(mid)
      if (r) list.push({ label: `${nama}${porsi > 1 ? ` x${porsi}` : ''}`, expected: r.qpp * porsi })
    }
    kandidat.set(it.order_id, list)
  }

  // cocokkan tiap baris ledger dengan kandidat berdasarkan qty; fallback: semua kandidat order itu
  const dipakai = new Map<string, Set<number>>()
  for (const r of pakaiRows) {
    const list = kandidat.get(r.ref_order_id as string) || []
    if (list.length === 0) continue
    const used = dipakai.get(r.ref_order_id as string) || new Set<number>()
    const idx = list.findIndex((k, i) => !used.has(i) && Math.abs(k.expected - Math.abs(r.qty)) < 0.5)
    if (idx >= 0) {
      used.add(idx)
      dipakai.set(r.ref_order_id as string, used)
      out.set(r.id, list[idx].label)
    } else {
      out.set(r.id, list.map((k) => k.label).join(', '))
    }
  }
  return out
}

export interface OpnameSessionSummary {
  id: string
  tanggal: string
  tipe: string
  status: string
  notes: string | null
  created_at: string
  approved_at: string | null
  created_by_name: string | null
  item_count: number
  flagged_count: number
}

export interface DiagnosticAlert {
  type: 'ANOMALI_SKALA' | 'TUKAR_BAHAN' | 'BOM_MISMATCH' | 'SJ_GANTUNG' | 'NOMINAL_EKSTREM'
  severity: 'danger' | 'warning' | 'info'
  message: string
}

export interface MenuItemUsage {
  menu_item_name: string
  porsi_terjual: number
  qty_per_porsi: number
  satuan: string
  total_pemakaian: number
}

export interface VendorMasuk {
  vendor_nama: string
  qty: number
  /**
   * Harga rata-rata tertimbang per satuan kirim dari harga beku surat jalan vendor
   * ini; null/absen bila tak ada harga surat jalan (tampilan memakai harga master).
   */
  harga_kirim?: number | null
}

export interface ReconciliationItem {
  bahan_baku_id: string
  nama: string
  kategori: string
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  harga_beli_master: number
  unit_price_kecil: number
  satuan_kirim: string
  harga_master_kirim: number
  
  // Qty (dalam satuan terkecil / gram)
  saldo_awal_qty: number
  masuk_qty: number
  pakai_qty: number
  waste_qty: number
  mutasi_lain_qty: number
  stok_sistem_qty: number
  stok_fisik_qty: number | null
  selisih_qty: number
  /**
   * Stok sistem hanya dari outlet yang menghitung fisik bahan ini -- pembanding
   * selisih. Untuk outlet tunggal = stok_sistem_qty; mode Semua Outlet bisa lebih
   * kecil (outlet yang tidak opname tidak ikut selisih). null bila tak ada opname.
   */
  stok_sistem_terhitung_qty?: number | null
  stok_sistem_terhitung_rp?: number | null
  /** Jumlah outlet yang menghitung fisik bahan ini dari outlet yang memegangnya. */
  outlet_opname_count?: number
  outlet_total_count?: number
  
  // Valuasi Rupiah
  saldo_awal_rp: number
  masuk_rp_master: number
  masuk_rp_riil: number | null
  pakai_rp: number
  /** Pemakaian dinilai harga kiriman yang stoknya terpakai (FIFO); opsional untuk data lama. */
  pakai_rp_riil?: number
  waste_rp: number
  mutasi_lain_rp: number
  stok_sistem_rp: number
  stok_fisik_rp: number | null
  selisih_rp: number
  
  vendor_masuk?: VendorMasuk[]
  vendor_pakai?: VendorMasuk[]

  has_opname: boolean
  status: 'MATCH' | 'MINUS' | 'SURPLUS' | 'TIDAK_OPNAME'
  selisih_persen: number | null
  diagnostics: DiagnosticAlert[]
  menu_usages: MenuItemUsage[]
}

export interface ReconciliationTotals {
  total_awal_rp: number
  total_masuk_rp_master: number
  total_masuk_rp_riil: number
  total_pakai_rp: number
  total_pakai_rp_riil?: number
  /** Mutasi lain (transfer, retur, penyesuaian) dalam harga master -- penutup persamaan kartu. */
  total_mutasi_lain_rp?: number
  total_waste_rp: number
  total_sistem_rp: number
  total_fisik_rp: number
  total_selisih_rp: number
  bahan_berselisih_count: number
  anomali_skala_count: number
  /** Bahan sejenis dengan selisih berlawanan (kemungkinan salah pilih bahan). */
  tukar_bahan_count?: number
  ekstrem_count: number
  // Efisiensi bahan: omzet periode vs biaya bahan
  omzet_rp: number // omzet KOTOR (sebelum diskon/promo)
  potongan_rp: number
  order_count: number
  teoritis_pakai_rp: number
  teoritis_tidak_terhitung: number
}

export interface MenuBomIngredient {

  bahan_baku_id: string
  nama_bahan: string
  qty_per_porsi: number
  satuan: string
  total_kebutuhan: number
}

export interface MenuBomBreakdownItem {
  menu_item_id: string
  menu_item_name: string
  total_porsi: number
  has_recipe: boolean
  ingredients: MenuBomIngredient[]
}

export interface ReconciliationPeriodInfo {
  mode: 'opname_session' | 'date_range'
  opname_terpilih?: OpnameSessionSummary | null
  opname_sebelumnya?: OpnameSessionSummary | null
  /**
   * Batas jendela sebenarnya. Outlet tunggal = persis jendela outlet itu; Semua
   * Outlet = awal paling dini & akhir paling akhir dari jendela tiap outlet.
   */
  start_date: string
  end_date: string
  /** Tanggal (YYYY-MM-DD) yang dipilih pengguna di mode Rentang Tanggal. */
  tanggal_mulai?: string
  tanggal_akhir?: string
  /**
   * Jendela per outlet (lib/stok/jendelaRentangOpname). Mode Rentang Tanggal:
   * awal = tutup opname terakhir sebelum tanggal mulai, akhir = tutup opname
   * terakhir pada tanggal akhir; tanpa opname -> batas hari WIB.
   */
  jendela_outlet?: Record<string, JendelaOutlet>
}

export interface ReconciliationSnapshotResponse {
  outlet: { id: string; name: string }
  period: ReconciliationPeriodInfo
  pending_surat_jalan_count: number
  items: ReconciliationItem[]
  totals: ReconciliationTotals
  menu_breakdown?: MenuBomBreakdownItem[]
  audit_note: string | null
}


export interface LedgerTimelineRow {
  id: string
  created_at: string
  tipe: string
  catatan: string | null
  qty: number
  harga_satuan: number
  /** Harga beku surat jalan per satuan besar; null bila baris bukan surat jalan / tanpa harga. */
  harga_sj_besar: number | null
  /** Harga rata-rata lapisan FIFO (per satuan besar) untuk barang keluar tanpa surat jalan. */
  harga_fifo_besar: number | null
  debet_rp: number
  kredit_rp: number
  saldo_sesudah_qty: number
  saldo_sesudah_rp: number
  ref_shipment_id: string | null
  ref_order_id: string | null
  ref_opname_id: string | null
  ref_transfer_id: string | null
  ref_doc_number: string | null
  vendor_nama: string | null
  vendor_estimasi: string | null
  menu_terjual: string | null
}

export interface OutletOverviewItem {
  outlet_id: string
  outlet_name: string
  last_opname: {
    id: string
    tanggal: string
    tipe: string
    status: string
    created_at: string
    created_by_name: string | null
    total_items: number
    flagged_items: number
    total_selisih_rp: number
    anomali_skala_count: number
  } | null
}

/**
 * Mengambil daftar outlet yang dapat diakses oleh user yang sedang login
 */
export async function fetchAccessibleOutlets(): Promise<{ id: string; name: string }[]> {
  const { staff, serviceClient } = await requireManagementAuth()

  const isPrivileged = [
    'admin',
    'admin_hr',
    'hr',
    'owner',
    'spv',
    'kitchen',
    'admin_finance',
    'finance',
    'purchasing',
    'developer',
    'regional_manager',
  ].includes(staff.role)

  if (isPrivileged) {
    const { data, error } = await serviceClient
      .from('outlets')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) throw new Error(`Gagal mengambil daftar outlet: ${error.message}`)
    return data || []
  }

  // Untuk role multi-outlet scoped (leader, area_manager, dsb):
  const { data: staffOutlets, error: soError } = await serviceClient
    .from('staff_outlets')
    .select('outlet_id, outlets(id, name, is_active)')
    .eq('staff_id', staff.id)

  if (soError) throw new Error(`Gagal mengambil outlet staff: ${soError.message}`)

  const outletMap = new Map<string, string>()
  for (const row of staffOutlets || []) {
    const o = (row as any).outlets
    if (o && o.is_active) {
      outletMap.set(o.id, o.name)
    }
  }

  if (staff.outlet_id) {
    const { data: homeOutlet } = await serviceClient
      .from('outlets')
      .select('id, name, is_active')
      .eq('id', staff.outlet_id)
      .maybeSingle()

    if (homeOutlet && homeOutlet.is_active) {
      outletMap.set(homeOutlet.id, homeOutlet.name)
    }
  }

  return Array.from(outletMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Mengambil ringkasan status opname & selisih seluruh cabang untuk mode "Pantau Semua Cabang"
 */
export async function fetchMultiOutletOverview(): Promise<OutletOverviewItem[]> {
  const outlets = await fetchAccessibleOutlets()
  if (outlets.length === 0) return []

  const supabase = makeServiceClient()
  const outletIds = outlets.map((o) => o.id)

  // 1. Opname terbaru per outlet — satu kueri limit(1) per outlet, paralel.
  // Dulu: SELURUH riwayat opname semua outlet ditarik lalu diambil baris
  // pertama per outlet di JS. Riwayat itu sudah ribuan baris → terpotong
  // diam-diam di 1.000 (max-rows PostgREST), sehingga outlet yang opname
  // terakhirnya jatuh di luar 1.000 baris teratas tampil "belum pernah opname".
  // Semantik sama: status finalized/pending_approval, created_at terbaru;
  // tiebreak id agar deterministik.
  const latestResults = await Promise.all(
    outletIds.map((outletId) =>
      supabase
        .from('opname')
        .select(`
          id,
          outlet_id,
          tanggal,
          tipe,
          status,
          created_at,
          outlet_staff!opname_created_by_fkey(name)
        `)
        .eq('outlet_id', outletId)
        .in('status', ['finalized', 'pending_approval'])
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
    )
  )

  const latestOpnamePerOutlet = new Map<string, any>()
  for (const res of latestResults) {
    if (res.error) throw new Error(`Gagal memuat rekap opname cabang: ${res.error.message}`)
    const op = res.data?.[0]
    if (op) latestOpnamePerOutlet.set(op.outlet_id, op)
  }

  const latestOpnameIds = Array.from(latestOpnamePerOutlet.values()).map((o) => o.id)

  // Item opname terakhir semua outlet (~20 opname × ~60 bahan) bisa melewati
  // 1.000 baris → ditarik habis per halaman dengan urutan unik (id).
  const fetchAllOpnameItems = async (): Promise<{ data: any[] }> => {
    if (latestOpnameIds.length === 0) return { data: [] }
    const PAGE_SIZE = 1000
    let all: any[] = []
    let fromRow = 0
    while (true) {
      const { data: rows, error: itemErr } = await supabase
        .from('opname_item')
        .select('opname_id, bahan_baku_id, selisih, flagged')
        .in('opname_id', latestOpnameIds)
        .order('id')
        .range(fromRow, fromRow + PAGE_SIZE - 1)
      // Galat diabaikan seperti sebelumnya (dulu itemsRes.error tak dicek).
      if (itemErr) break
      const pageRows = rows ?? []
      all = all.concat(pageRows)
      if (pageRows.length < PAGE_SIZE) break
      fromRow += PAGE_SIZE
    }
    return { data: all }
  }

  // 2. Fetch master bahan, harga, dan item opname
  const [bahanRes, hargaRes, itemsRes] = await Promise.all([
    supabase.from('bahan_baku').select('id, satuan, faktor_tampilan').eq('is_active', true),
    supabase.from('bahan_baku_harga').select('bahan_baku_id, harga_beli'),
    fetchAllOpnameItems(),
  ])

  const bahanMap = new Map((bahanRes.data || []).map((b) => [b.id, b]))
  const hargaMap = new Map((hargaRes.data || []).map((h) => [h.bahan_baku_id, h.harga_beli || 0]))

  // Kelompokkan item per opname_id
  const opnameItemsGroup = new Map<string, any[]>()
  for (const item of itemsRes.data || []) {
    let group = opnameItemsGroup.get(item.opname_id)
    if (!group) {
      group = []
      opnameItemsGroup.set(item.opname_id, group)
    }
    group.push(item)
  }

  // 3. Susun per outlet
  return outlets.map((o) => {
    const latestOp = latestOpnamePerOutlet.get(o.id)
    if (!latestOp) {
      return {
        outlet_id: o.id,
        outlet_name: o.name,
        last_opname: null,
      }
    }

    const items = opnameItemsGroup.get(latestOp.id) || []
    let totalSelisihRp = 0
    let flaggedCount = 0
    let anomaliSkalaCount = 0

    for (const it of items) {
      if (it.flagged) flaggedCount++
      const selisih = Number(it.selisih || 0)
      if (Math.abs(selisih) > 0.01) {
        const b = bahanMap.get(it.bahan_baku_id)
        const hargaMaster = hargaMap.get(it.bahan_baku_id) || 0
        const kemasanQty = Number(b?.faktor_tampilan) || 1
        const unitPriceKecil = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster
        totalSelisihRp += Math.round(selisih * unitPriceKecil)

        if (isKelipatanKemasan(selisih, kemasanQty)) {
          anomaliSkalaCount++
        }
      }
    }

    return {
      outlet_id: o.id,
      outlet_name: o.name,
      last_opname: {
        id: latestOp.id,
        tanggal: latestOp.tanggal,
        tipe: latestOp.tipe,
        status: latestOp.status,
        created_at: latestOp.created_at,
        created_by_name: (latestOp as any).outlet_staff?.name || null,
        total_items: items.length,
        flagged_items: flaggedCount,
        total_selisih_rp: totalSelisihRp,
        anomali_skala_count: anomaliSkalaCount,
      },
    }
  })
}

/**
 * Mengambil daftar sesi opname yang pernah difinalisasi di outlet ini
 */
export async function fetchOpnameSessions(outletId: string): Promise<OpnameSessionSummary[]> {
  await requireManagementAuth(outletId)
  const supabase = makeServiceClient()

  const { data, error } = await supabase
    .from('opname')
    .select(`
      id,
      tanggal,
      tipe,
      status,
      notes,
      created_at,
      approved_at,
      outlet_staff!opname_created_by_fkey(name),
      opname_item(id, flagged)
    `)
    .eq('outlet_id', outletId)
    .in('status', ['finalized', 'pending_approval'])
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw new Error(`Gagal memuat sesi opname: ${error.message}`)

  return (data || []).map((o: any) => ({
    id: o.id,
    tanggal: o.tanggal,
    tipe: o.tipe,
    status: o.status,
    notes: o.notes,
    created_at: o.created_at,
    approved_at: o.approved_at,
    created_by_name: o.outlet_staff?.name || null,
    item_count: o.opname_item?.length || 0,
    flagged_count: o.opname_item?.filter((item: any) => item.flagged)?.length || 0,
  }))
}

/**
 * Waktu tutup banyak opname sekaligus (lihat lib/stok/waktuTutupOpname): baris
 * ledger pertama milik tiap opname -> updated_at -> created_at. Satu kueri
 * berhalaman, bukan satu kueri per opname.
 */
async function ambilWaktuTutupBanyak(
  supabase: ReturnType<typeof makeServiceClient>,
  opnames: { id: string; created_at: string; updated_at?: string | null; status?: string | null }[]
): Promise<Map<string, string>> {
  const pertama = new Map<string, string>()
  const ids = [...new Set(opnames.map((o) => o.id))]
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    try {
      const rows = await fetchAllPages<any>(() =>
        supabase
          .from('ledger_stok')
          .select('id, ref_opname_id, created_at')
          .in('ref_opname_id', chunk)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      )
      for (const r of rows) if (!pertama.has(r.ref_opname_id)) pertama.set(r.ref_opname_id, r.created_at)
    } catch (e) {
      console.warn('Gagal memuat waktu tutup opname:', e)
    }
  }
  const out = new Map<string, string>()
  for (const o of opnames) out.set(o.id, pilihWaktuTutupOpname(o, pertama.get(o.id)))
  return out
}

function keRingkasanOpname(o: any): OpnameSessionSummary {
  return {
    id: o.id,
    tanggal: o.tanggal,
    tipe: o.tipe,
    status: o.status,
    notes: o.notes ?? null,
    created_at: o.created_at,
    approved_at: o.approved_at ?? null,
    created_by_name: o.outlet_staff?.name || null,
    item_count: 0,
    flagged_count: 0,
  }
}

/**
 * Mengambil data Rekonsiliasi Snapshot Periodik
 */
export async function fetchReconciliationSnapshot(
  outletId: string,
  params: {
    mode: 'opname_session' | 'date_range'
    opnameId?: string
    startDate?: string
    endDate?: string
  }
): Promise<ReconciliationSnapshotResponse> {
  const isAll = outletId === 'ALL'
  await requireManagementAuth(isAll ? undefined : outletId)
  const supabase = makeServiceClient()

  let outletName = 'Semua Outlet'
  let targetOutletIds: string[] = []

  if (isAll) {
    const accessibleOutlets = await fetchAccessibleOutlets()
    if (accessibleOutlets.length === 0) {
      throw new Error('Tidak ada cabang yang dapat diakses')
    }
    const { data: outletMeta } = await supabase
      .from('outlets')
      .select('id, name, type')
      .in('id', accessibleOutlets.map((o) => o.id))
    const typeMap = new Map((outletMeta || []).map((o: any) => [o.id, o.type]))
    const retailOutlets = accessibleOutlets.filter((o) =>
      isRetailSalesOutlet({ name: o.name, type: typeMap.get(o.id) })
    )
    const chosenOutlets = retailOutlets.length > 0 ? retailOutlets : accessibleOutlets
    targetOutletIds = chosenOutlets.map((o) => o.id)
    outletName = `Semua Outlet (${targetOutletIds.length} Cabang)`
  } else {
    targetOutletIds = [outletId]
    const { data: outletData } = await supabase
      .from('outlets')
      .select('id, name')
      .eq('id', outletId)
      .single()
    outletName = outletData?.name || 'Outlet'
  }

  let startIso = ''
  let endIso = ''
  let opnameTerpilih: OpnameSessionSummary | null = null
  let opnameSebelumnya: OpnameSessionSummary | null = null
  // Hitungan fisik per pasangan (outlet, bahan) -- kunciOB:
  // - prevFisikOB: opname sebelum periode (baseline Saldo Awal); hanya qty_fisik terisi.
  // - fisikPenutupOB: opname penutup periode; null = bahan ada di opname tapi tidak dihitung.
  // Disimpan per outlet agar mode Semua Outlet membandingkan fisik vs sistem dari
  // outlet yang SAMA (lihat lib/stok/rekonsiliasiOutlet).
  const prevFisikOB = new Map<string, number>()
  const fisikPenutupOB = new Map<string, number | null>()
  let auditNote: string | null = null
  // Jendela waktu tiap outlet; startIso/endIso = gabungannya (lib/stok/jendelaRentangOpname).
  let jendelaOutlet = new Map<string, JendelaOutlet>()
  let tanggalMulai: string | undefined
  let tanggalAkhir: string | undefined

  if (!isAll && params.mode === 'opname_session') {
    if (!params.opnameId) throw new Error('Parameter opnameId wajib diisi pada mode sesi opname')

    // Ambil opname terpilih
    const { data: curOpname, error: curErr } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, updated_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('id', params.opnameId)
      .single()

    if (curErr || !curOpname) throw new Error('Sesi opname terpilih tidak ditemukan')

    opnameTerpilih = {
      id: curOpname.id,
      tanggal: curOpname.tanggal,
      tipe: curOpname.tipe,
      status: curOpname.status,
      notes: curOpname.notes,
      created_at: curOpname.created_at,
      approved_at: curOpname.approved_at,
      created_by_name: (curOpname as any).outlet_staff?.name || null,
      item_count: 0,
      flagged_count: 0,
    }
    auditNote = curOpname.notes

    // Batas = saat finalisasi, bukan saat draf dibuat (lihat lib/stok/waktuTutupOpname)
    endIso = await ambilWaktuTutupOpname(supabase, curOpname)

    // Ambil item opname terpilih
    const { data: curItems } = await supabase
      .from('opname_item')
      .select('bahan_baku_id, qty_fisik, qty_system, selisih')
      .eq('opname_id', curOpname.id)

    for (const item of curItems || []) {
      fisikPenutupOB.set(
        kunciOB(outletId, item.bahan_baku_id),
        item.qty_fisik === null || item.qty_fisik === undefined ? null : Number(item.qty_fisik)
      )
    }

    // Cari opname sebelumnya sebelum opname terpilih
    const { data: prevOpnameList } = await supabase
      .from('opname')
      .select('id, tanggal, tipe, status, notes, created_at, updated_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
      .eq('outlet_id', outletId)
      .eq('status', 'finalized')
      .lt('created_at', curOpname.created_at)
      .order('created_at', { ascending: false })
      .limit(1)

    if (prevOpnameList && prevOpnameList.length > 0) {
      const prev = prevOpnameList[0]
      opnameSebelumnya = {
        id: prev.id,
        tanggal: prev.tanggal,
        tipe: prev.tipe,
        status: prev.status,
        notes: prev.notes,
        created_at: prev.created_at,
        approved_at: prev.approved_at,
        created_by_name: (prev as any).outlet_staff?.name || null,
        item_count: 0,
        flagged_count: 0,
      }
      startIso = await ambilWaktuTutupOpname(supabase, prev)

      // Ambil item opname sebelumnya sebagai baseline Saldo Awal
      const { data: prevItems } = await supabase
        .from('opname_item')
        .select('bahan_baku_id, qty_fisik')
        .eq('opname_id', prev.id)

      for (const item of prevItems || []) {
        if (item.qty_fisik !== null && item.qty_fisik !== undefined) {
          prevFisikOB.set(kunciOB(outletId, item.bahan_baku_id), Number(item.qty_fisik))
        }
      }
    } else {
      // Jika belum ada opname sebelumnya, gunakan awal hari opname atau 7 hari sebelumnya
      const dateObj = new Date(curOpname.created_at)
      dateObj.setDate(dateObj.getDate() - 7)
      startIso = dateObj.toISOString()
    }
    jendelaOutlet = new Map([
      [
        outletId,
        {
          start: startIso,
          end: endIso,
          opname_awal_id: opnameSebelumnya?.id ?? null,
          opname_penutup_id: opnameTerpilih?.id ?? null,
        },
      ],
    ])
  } else {
    // Mode Rentang Tanggal: batas PER OUTLET mengikuti waktu tutup opname
    // (lib/stok/jendelaRentangOpname), sama dengan mode sesi opname. Rentang
    // 21–22 Nov satu outlet = sesi 21 Nov + sesi 22 Nov.
    const sDate = params.startDate || new Date().toISOString().slice(0, 10)
    const eDate = params.endDate || sDate
    tanggalMulai = sDate
    tanggalAkhir = eDate

    const batasMundurIso = new Date(
      Date.parse(batasHariWIB(sDate).awalIso) - BATAS_MUNDUR_BASELINE_HARI * 86400000
    ).toISOString()
    let kandidat: any[]
    try {
      // Satu kueri untuk semua outlet (dulu 2 kueri per outlet).
      kandidat = await fetchAllPages<any>(() =>
        supabase
          .from('opname')
          .select('id, outlet_id, tanggal, tipe, status, notes, created_at, updated_at, approved_at, outlet_staff!opname_created_by_fkey(name)')
          .in('outlet_id', targetOutletIds)
          .eq('status', 'finalized')
          .gte('created_at', batasMundurIso)
          .lte('created_at', batasHariWIB(eDate).akhirIso)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      )
    } catch (e: any) {
      throw new Error(`Gagal memuat opname rentang: ${e?.message ?? e}`)
    }

    const pilihan = pilihOpnameRentang({
      outletIds: targetOutletIds,
      startDate: sDate,
      endDate: eDate,
      opnames: kandidat,
    })
    const dipilih = [...pilihan.values()].flatMap((p) => [p.awal, p.penutup]).filter((o): o is any => !!o)
    const waktuTutup = await ambilWaktuTutupBanyak(supabase, dipilih)
    jendelaOutlet = susunJendelaOutlet({
      outletIds: targetOutletIds,
      startDate: sDate,
      endDate: eDate,
      pilihan,
      waktuTutup,
    })
    const gab = rentangGabungan(jendelaOutlet.values())
    startIso = gab.start
    endIso = gab.end

    if (!isAll) {
      const p = pilihan.get(outletId)
      if (p?.awal) opnameSebelumnya = keRingkasanOpname(p.awal)
      if (p?.penutup) {
        opnameTerpilih = keRingkasanOpname(p.penutup)
        auditNote = p.penutup.notes ?? null
      }
    }

    // Item opname baseline (Saldo Awal) & penutup (Stok Fisik), disimpan per outlet.
    const peranOpname = new Map<string, { outletId: string; peran: 'awal' | 'penutup' }>()
    for (const [oId, p] of pilihan) {
      if (p.awal) peranOpname.set(p.awal.id, { outletId: oId, peran: 'awal' })
      if (p.penutup) peranOpname.set(p.penutup.id, { outletId: oId, peran: 'penutup' })
    }
    const opnameIds = [...peranOpname.keys()]
    if (opnameIds.length > 0) {
      let items: any[] = []
      try {
        for (let i = 0; i < opnameIds.length; i += 100) {
          const chunk = opnameIds.slice(i, i + 100)
          items.push(
            ...(await fetchAllPages<any>(() =>
              supabase
                .from('opname_item')
                .select('id, opname_id, bahan_baku_id, qty_fisik')
                .in('opname_id', chunk)
                .order('id')
            ))
          )
        }
      } catch (e) {
        console.warn('Gagal memuat item opname rentang:', e)
        items = []
      }
      for (const item of items) {
        const r = peranOpname.get(item.opname_id)
        if (!r) continue
        const k = kunciOB(r.outletId, item.bahan_baku_id)
        const ada = item.qty_fisik !== null && item.qty_fisik !== undefined
        if (r.peran === 'awal') {
          // Bahan tak dihitung di baseline jatuh ke saldo ledger (saldoAwalOutlet), bukan 0.
          if (ada) prevFisikOB.set(k, Number(item.qty_fisik))
        } else {
          // Per outlet -- stok outlet yang tak opname tidak ikut selisih (rekonsiliasiOutlet).
          fisikPenutupOB.set(k, ada ? Number(item.qty_fisik) : null)
        }
      }
    }
  }

  // Penerapan jendela per outlet ke kueri. Satu jendela (outlet tunggal / sesi
  // opname) = filter rentang biasa; beberapa jendela = .or() per outlet, supaya
  // baris di luar jendela outletnya sendiri tidak ikut terambil.
  const satuJendela = jendelaOutlet.size === 1
  const terapkanJendela = (q: any, kolom = 'created_at') => {
    if (satuJendela) {
      const [[oId, j]] = [...jendelaOutlet.entries()]
      return q.eq('outlet_id', oId).gte(kolom, j.start).lte(kolom, j.end)
    }
    return q.in('outlet_id', [...jendelaOutlet.keys()]).or(filterOrJendela(jendelaOutlet, kolom))
  }

  // 2. Cek Surat Jalan menggantung / in-transit di sekitar cut-off
  const pendingSjQuery = supabase
    .from('surat_jalan')
    .select('id, document_number, status, created_at')
    .in('status', ['dikirim', 'in_transit', 'menunggu_verifikasi'])
    .lte('created_at', endIso)

  const { data: pendingSjList } = isAll
    ? await pendingSjQuery.in('outlet_id', targetOutletIds)
    : await pendingSjQuery.eq('outlet_id', outletId)

  const pendingSjCount = pendingSjList?.length || 0

  // 3. Ambil Master Bahan Baku, Harga, dan Penanda Skala Saldo (stok_balance.saldo_is_gram)
  const [bahanRes, hargaRes, balanceScaleRows] = await Promise.all([
    supabase
      .from('bahan_baku')
      .select('id, nama, kategori, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan, faktor_konversi, satuan_distribusi, is_active')
      .eq('is_active', true)
      .order('kategori', { ascending: true })
      .order('nama', { ascending: true }),
    supabase
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli, kemasan_qty'),
    fetchAllPages<any>(() => {
      const q = supabase
        .from('stok_balance')
        .select('outlet_id, bahan_baku_id, saldo_is_gram')
        .eq('saldo_is_gram', false)
        .order('outlet_id', { ascending: true })
        .order('bahan_baku_id', { ascending: true })
      return isAll ? q.in('outlet_id', targetOutletIds) : q.eq('outlet_id', outletId)
    }).catch(() => [] as any[]),
  ])

  const hargaMap = new Map((hargaRes.data || []).map((h) => [h.bahan_baku_id, h]))
  const notGramSet = new Set<string>(
    (balanceScaleRows || []).map((sb: any) => `${sb.outlet_id}_${sb.bahan_baku_id}`)
  )
  const faktorPenuhMap = new Map<string, number>()
  for (const b of bahanRes.data || []) {
    const h = hargaMap.get(b.id)
    const f = Number(b.faktor_tampilan) || Number((b as any).faktor_konversi) || Number(h?.kemasan_qty) || 1
    faktorPenuhMap.set(b.id, f > 0 ? f : 1)
  }

  // Normalisasi baris ledger ke satuan kecil apabila pasangan (outlet, bahan) di stok_balance
  // masih berskala satuan besar (saldo_is_gram = false).
  const normalizeLedgerRow = (row: any) => {
    const oId = row.outlet_id || outletId
    const bId = row.bahan_baku_id
    if (!notGramSet.has(`${oId}_${bId}`)) return row
    const f = faktorPenuhMap.get(bId) || 1
    if (f <= 1) return row
    return {
      ...row,
      qty: row.qty !== null && row.qty !== undefined ? Number(row.qty) * f : row.qty,
      saldo_sebelum:
        row.saldo_sebelum !== null && row.saldo_sebelum !== undefined ? Number(row.saldo_sebelum) * f : row.saldo_sebelum,
      saldo_sesudah:
        row.saldo_sesudah !== null && row.saldo_sesudah !== undefined ? Number(row.saldo_sesudah) * f : row.saldo_sesudah,
    }
  }

  // ASET (mis. printer) & PERLENGKAPAN (mis. ID card) bukan bahan baku -> tak ikut rekonsiliasi stok.
  const KATEGORI_NON_BAHAN = ['ASET', 'PERLENGKAPAN']
  const bahanList = (bahanRes.data || []).filter(
    (b) => !KATEGORI_NON_BAHAN.includes(String(b.kategori || '').toUpperCase())
  )

  // 4. Ambil mutasi dari ledger_stok antara startIso dan endIso.
  // WAJIB berhalaman: 40% periode opname September melampaui 1000 baris
  // (terbanyak 6.054) -- dulu satu request polos diam-diam hanya membawa 1000
  // baris TERLAMA, sehingga mutasi terbaru hilang dari rekonsiliasi.
  let rawLedgerRows: any[]
  try {
    rawLedgerRows = await fetchAllPages<any>(() => {
      const q = supabase
        .from('ledger_stok')
        .select('id, outlet_id, bahan_baku_id, tipe, qty, catatan, created_at, ref_shipment_id, ref_opname_id, ref_terima_vendor_id, ref_po_id, ref_order_id, ref_waste_id, saldo_sebelum, saldo_sesudah')
        .neq('tipe', 'opname_selisih')
      // Jendela per outlet (mode Rentang Tanggal Semua Outlet: tiap outlet punya batas opname sendiri).
      return terapkanJendela(q)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    })
  } catch (e: any) {
    throw new Error(`Gagal memuat mutasi ledger: ${e?.message ?? e}`)
  }

  // Filter keluar baris 'opname_selisih' di JavaScript:
  // Catatan: 'opname_selisih' BUKAN mutasi operasional (bukan kiriman, pemakaian, atau waste).
  // Jika 'opname_selisih' dimasukkan ke mutasi, maka stok sistem otomatis dipaksa sama dengan fisik!
  const ledgerRows = (rawLedgerRows || [])
    .filter((row) => row.tipe !== 'opname_selisih')
    .map(normalizeLedgerRow)

  // 4a. Ambil stok_waste_reports berstatus APPROVED pada rentang waktu ini (baik mode
  // Semua Outlet maupun outlet tunggal) karena waste yang disetujui sesudah opname hari
  // yang sama dicatat dengan qty = 0 di ledger_stok (agar tidak memotong stok_balance dua kali).
  // Per (outlet, bahan) -- kunciOB -- agar bisa dibandingkan per outlet.
  const approvedWasteOB = new Map<string, number>()
  if (targetOutletIds.length > 0) {
    try {
      const wasteReports = await fetchAllPages<any>(() =>
        terapkanJendela(
          supabase
            .from('stok_waste_reports')
            .select('id, outlet_id, bahan_baku_id, qty, status, created_at')
            .eq('status', 'APPROVED')
        )
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      )
      for (const w of wasteReports || []) {
        const f = faktorPenuhMap.get(w.bahan_baku_id) || 1
        const qKecil = Math.abs(Number(w.qty || 0)) * f
        const k = kunciOB(w.outlet_id, w.bahan_baku_id)
        approvedWasteOB.set(k, (approvedWasteOB.get(k) || 0) + qKecil)
      }
    } catch (e) {
      console.warn('Gagal memuat laporan waste rekonsiliasi:', e)
    }
  }

  // 4b. Pemakaian POS dari order: tiap order diatribusikan ke periode potongan
  // PERTAMANYA dengan neto SELURUH mutasinya (lihat lib/stok/mutasiOrder). Untuk
  // itu perlu juga baris order yang sama di luar periode: pembalik yang datang
  // belakangan, dan potongan sebelum periode (order lama yang dibatalkan di sini).
  const orderRowsPeriode = ledgerRows.filter((r) => isMutasiOrder(r))
  const orderIdsPeriode = [...new Set(orderRowsPeriode.map((r) => r.ref_order_id as string))]
  const orderRowsLuar: any[] = []
  const idBarisPeriode = new Set(orderRowsPeriode.map((r) => r.id as string))
  try {
    for (let i = 0; i < orderIdsPeriode.length; i += 200) {
      const chunk = orderIdsPeriode.slice(i, i + 200)
      const fetchedChunk = await fetchAllPages<any>(() => {
        let q = supabase
          .from('ledger_stok')
          .select('id, outlet_id, bahan_baku_id, tipe, qty, created_at, ref_order_id')
          .in('ref_order_id', chunk)
          .in('tipe', ['pemakaian', 'adjustment'])
        // Satu jendela: cukup baris di luarnya. Beberapa jendela (per outlet): ambil
        // semua baris order itu lalu buang yang sudah ada di periode (dedup id).
        if (satuJendela) q = q.or(`created_at.lt."${startIso}",created_at.gt."${endIso}"`)
        q = q.order('created_at', { ascending: true }).order('id', { ascending: true })
        return isAll ? q.in('outlet_id', targetOutletIds) : q.eq('outlet_id', outletId)
      })
      orderRowsLuar.push(...fetchedChunk.filter((r) => !idBarisPeriode.has(r.id)).map(normalizeLedgerRow))
    }
  } catch (e: any) {
    throw new Error(`Gagal memuat mutasi order di luar periode: ${e?.message ?? e}`)
  }
  // Per (outlet, bahan): kunci bahan diganti kunciOB. Order milik satu outlet, jadi
  // atribusi per order tidak berubah. Tiap outlet diatribusikan terhadap jendelanya
  // sendiri (mode Rentang Tanggal: batas opname per outlet).
  const pakaiOrderOB = new Map<string, number>()
  {
    const barisPerOutlet = new Map<string, any[]>()
    for (const r of [...orderRowsPeriode, ...orderRowsLuar]) {
      const oId = r.outlet_id || outletId
      const list = barisPerOutlet.get(oId) || []
      list.push({ ...r, bahan_baku_id: kunciOB(oId, r.bahan_baku_id) })
      barisPerOutlet.set(oId, list)
    }
    for (const [oId, rows] of barisPerOutlet) {
      const j = jendelaOutlet.get(oId)
      if (!j) continue
      for (const [k, v] of pemakaianPosPerBahan(rows, j.start, j.end)) {
        pakaiOrderOB.set(k, (pakaiOrderOB.get(k) || 0) + v)
      }
    }
  }

  // 5. Ambil harga pengadaan riil dari surat_jalan_item untuk transaksi terima_kiriman dalam periode
  const shipmentIds = [
    ...new Set(
      (ledgerRows || [])
        .map((l) => l.ref_shipment_id)
        .filter((v): v is string => !!v)
    ),
  ]

  // Nilai dokumen surat jalan (qty dok x harga dok) -> harga per satuan kecil, dibagi
  // qty satuan kecil seluruh baris ledger surat jalan itu pada sisi & outlet yang sama.
  // Tidak memakai faktor satuan SEKARANG: definisi satuan besar beberapa bahan berubah
  // sesudah dokumen dibuat (FOIL 5M 36.480 -> 24.000 cm, PAPER WRAP 5.000 -> 500, dst).
  const sjItemsRekon = await fetchItemSuratJalan(
    supabase,
    shipmentIds,
    [...new Set((ledgerRows || []).filter((l) => l.ref_shipment_id).map((l) => l.bahan_baku_id as string))]
  )
  const qtyGrupSjRekon = new Map<string, number>()
  for (const l of ledgerRows || []) {
    if (!l.ref_shipment_id) continue
    const k = `${l.ref_shipment_id}|${l.bahan_baku_id}|${l.tipe}|${l.outlet_id}`
    qtyGrupSjRekon.set(k, (qtyGrupSjRekon.get(k) || 0) + Math.abs(Number(l.qty || 0)))
  }
  const hargaKecilSjRekon = (row: any): number | null => {
    if (!row.ref_shipment_id) return null
    const items = sjItemsRekon.get(`${row.ref_shipment_id}_${row.bahan_baku_id}`)
    if (!items) return null
    return hargaKecilDariNilai(
      nilaiDokumenSuratJalan(items, row.tipe),
      qtyGrupSjRekon.get(`${row.ref_shipment_id}|${row.bahan_baku_id}|${row.tipe}|${row.outlet_id}`) || 0
    )
  }

  const vendorOf = await resolveVendorNames(supabase, (ledgerRows || []) as any)
  const vendorMasukByBahan = new Map<string, Map<string, number>>()
  const vendorPakaiByBahan = new Map<string, Map<string, number>>()
  // Nilai pemakaian per vendor menurut harga lapisan FIFO (harga kiriman yang stoknya
  // terpakai); bagian tanpa harga kiriman dinilai master. Dipakai untuk label vendor
  // pakai dan harga rata-rata pemakaian per bahan (pakai_rp & biaya resep teoritis),
  // sama dengan yang ditampilkan timeline per baris.
  const nilaiVendorPakai = new Map<string, Map<string, { qty: number; nilai: number; adaHargaSj: boolean }>>()
  const masterKecilOf = (bId: string) => {
    const f = faktorPenuhMap.get(bId) || 1
    const h = Number(hargaMap.get(bId)?.harga_beli || 0)
    return f > 0 ? h / f : h
  }
  {
    const rowsByOutletBahan = new Map<string, { bId: string; rs: any[] }>()
    for (const r of ledgerRows || []) {
      const obKey = kunciOB(r.outlet_id || outletId, r.bahan_baku_id)
      let entry = rowsByOutletBahan.get(obKey)
      if (!entry) {
        entry = { bId: r.bahan_baku_id, rs: [] }
        rowsByOutletBahan.set(obKey, entry)
      }
      entry.rs.push(r)
    }
    // Lapisan saldo awal per (outlet, bahan): hanya sejumlah saldo awal pasangan itu.
    const kebutuhanAwal = new Map<string, number>()
    for (const [obKey, { rs }] of rowsByOutletBahan) {
      kebutuhanAwal.set(obKey, Math.max(Number(rs[0].saldo_sebelum || 0), 0))
    }
    const awalPerOutlet = new Map([...jendelaOutlet].map(([oId, j]) => [oId, j.start] as [string, string]))
    const priorByOB = await fetchPriorInflows(supabase, isAll ? targetOutletIds : outletId, awalPerOutlet, null, {
      kebutuhan: kebutuhanAwal,
      kunci: (row) => kunciOB(row.outlet_id || outletId, row.bahan_baku_id),
      normalisasi: normalizeLedgerRow,
    })
    for (const [obKey, { bId, rs }] of rowsByOutletBahan) {
      const masterKecil = masterKecilOf(bId)
      const win: FifoWindowRow[] = rs.map((r) => ({
        id: r.id,
        qty: Number(r.qty || 0),
        vendor: Number(r.qty) > 0 ? vendorOf(r) : null,
        harga: Number(r.qty) > 0 ? hargaKecilWajar(hargaKecilSjRekon(r), masterKecil) : null,
      }))
      const attr = attributeFifo({
        openingBalance: Number(rs[0].saldo_sebelum || 0),
        priorInflowsNewestFirst: (priorByOB.get(obKey) || []).map((l) => ({
          ...l,
          harga: hargaKecilWajar(l.harga ?? null, masterKecil),
        })),
        windowRows: win,
      })
      const m = vendorPakaiByBahan.get(bId) || new Map<string, number>()
      const nv = nilaiVendorPakai.get(bId) || new Map<string, { qty: number; nilai: number; adaHargaSj: boolean }>()
      for (const r of rs) {
        if (r.tipe !== 'pemakaian') continue
        for (const part of attr.get(r.id) || []) {
          m.set(part.vendor, (m.get(part.vendor) || 0) + part.qty)
          const cur = nv.get(part.vendor) || { qty: 0, nilai: 0, adaHargaSj: false }
          cur.qty += part.qty
          cur.nilai += part.qty * (part.harga !== null ? part.harga : masterKecil)
          cur.adaHargaSj = cur.adaHargaSj || part.harga !== null
          nv.set(part.vendor, cur)
        }
      }
      vendorPakaiByBahan.set(bId, m)
      nilaiVendorPakai.set(bId, nv)
    }
  }

  // 5b. Ambil data penjualan menu POS untuk breakdown pemakaian bahan per item
  const menuUsageByBahan = new Map<string, MenuItemUsage[]>()
  const menuBreakdownList: MenuBomBreakdownItem[] = []


  // Berhalaman: mode rentang tanggal bisa melampaui 1000 order (cap PostgREST).
  let ordersData: any[]
  try {
    ordersData = await fetchAllPages<any>(() => {
      const q = supabase
        .from('orders')
        .select('id, outlet_id, total_amount, discount_amount, promo_subsidy')
        .eq('status', 'completed')
      // Omzet ikut jendela per outlet agar sejalan dengan pemakaian.
      return terapkanJendela(q)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
    })
  } catch (e: any) {
    throw new Error(`Gagal memuat penjualan: ${e?.message ?? e}`)
  }

  const completedOrderIds = (ordersData || []).map((o) => o.id)
  let omzetRp = 0 // omzet kotor; diisi setelah subtotal item terkumpul
  let potonganRp = 0

  if (completedOrderIds.length > 0) {
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = []
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size))
      }
      return chunks
    }

    const orderChunks = chunkArray(completedOrderIds, 200)
    const allOrderItems: { menu_item_id: string; menu_item_name: string | null; quantity: number }[] = []
    const itemValueByOrder = new Map<string, { n: number; value: number }>()

    for (const chunk of orderChunks) {
      // 200 order bisa > 1000 item (order besar/paket) -> tetap berhalaman.
      let oiList: any[]
      try {
        oiList = await fetchAllPages<any>(() =>
          supabase
            .from('order_items')
            .select('order_id, menu_item_id, menu_item_name, quantity, subtotal')
            .in('order_id', chunk)
            .order('id', { ascending: true })
        )
      } catch (e: any) {
        throw new Error(`Gagal memuat item penjualan: ${e?.message ?? e}`)
      }

      for (const oi of oiList) {
        const cur = itemValueByOrder.get(oi.order_id) || { n: 0, value: 0 }
        cur.n++
        cur.value += Number(oi.subtotal || 0)
        itemValueByOrder.set(oi.order_id, cur)
        if (oi.menu_item_id !== null && oi.menu_item_id !== undefined) allOrderItems.push(oi)
      }
    }

    // Omzet KOTOR: acuan yang sama dengan laporan mitra --
    // max(total_amount, jumlah subtotal item); tanpa item: total + diskon + subsidi promo.
    for (const o of (ordersData || []) as any[]) {
      const total = Number(o.total_amount || 0)
      const it = itemValueByOrder.get(o.id)
      const gross = it && it.n > 0
        ? Math.max(total, it.value)
        : total + Number(o.discount_amount || 0) + Number(o.promo_subsidy || 0)
      omzetRp += gross
      potonganRp += gross - total
    }
    omzetRp = Math.round(omzetRp)
    potonganRp = Math.round(potonganRp)

    const soldMenuMap = new Map<string, { name: string; totalPorsi: number }>()
    for (const oi of allOrderItems) {
      const mid = String(oi.menu_item_id)
      const qty = Number(oi.quantity || 0)
      const existing = soldMenuMap.get(mid)
      if (existing) {
        existing.totalPorsi += qty
      } else {
        soldMenuMap.set(mid, {
          name: bersihNamaMenu(oi.menu_item_name) || `Menu #${mid}`,
          totalPorsi: qty,
        })
      }
    }

    const menuItemIds = Array.from(soldMenuMap.keys())
    if (menuItemIds.length > 0) {
      // Ambil data menu_packages untuk mendeteksi apakah ada menu paket/combo yang terjual
      const { data: pkgList } = await supabase
        .from('menu_packages')
        .select('package_id, menu_item_id, quantity')
        .in('package_id', menuItemIds)

      // Kumpulkan semua menu_item_id yang butuh resep:
      // Menu langsung + komponen dari menu paket
      const pkgMap = new Map<string, { menu_item_id: string; quantity: number }[]>()
      const allMenuIdsToFetch = new Set<string>(menuItemIds)

      for (const p of pkgList || []) {
        let list = pkgMap.get(p.package_id)
        if (!list) {
          list = []
          pkgMap.set(p.package_id, list)
        }
        list.push({
          menu_item_id: p.menu_item_id,
          quantity: Number(p.quantity || 1),
        })
        allMenuIdsToFetch.add(p.menu_item_id)
      }

      const { data: resepList } = await supabase
        .from('resep')
        .select(`
          id,
          menu_item_ref,
          scope,
          outlet_id,
          resep_item (
            bahan_baku_id,
            qty_per_porsi,
            satuan
          )
        `)
        .in('menu_item_ref', Array.from(allMenuIdsToFetch))
        .eq('is_active', true)

      const activeResepPerMenu = new Map<string, any>()
      for (const r of resepList || []) {
        const ref = r.menu_item_ref
        const currentBest = activeResepPerMenu.get(ref)
        if (isAll) {
          // Untuk Semua Outlet, utamakan resep global; gunakan resep outlet hanya jika belum ada resep global
          if (!currentBest || (currentBest.scope !== 'global' && r.scope === 'global')) {
            activeResepPerMenu.set(ref, r)
          }
        } else if (!currentBest) {
          if ((r.scope === 'outlet' && r.outlet_id === outletId) || r.scope === 'global') {
            activeResepPerMenu.set(ref, r)
          }
        } else if (currentBest.scope === 'global' && r.scope === 'outlet' && r.outlet_id === outletId) {
          activeResepPerMenu.set(ref, r)
        }
      }

      const bahanMap = new Map((bahanList || []).map((b) => [b.id, b]))

      for (const [mid, menuInfo] of soldMenuMap.entries()) {
        const directRecipe = activeResepPerMenu.get(mid)
        const hasDirectRecipe = !!(directRecipe && directRecipe.resep_item && directRecipe.resep_item.length > 0)
        const components = pkgMap.get(mid) || []
        const isPackage = components.length > 0

        let hasRecipe = hasDirectRecipe
        const ingredients: MenuBomIngredient[] = []

        if (isPackage) {
          // Kasus Menu Paket / Combo: Akumulasi BOM dari seluruh komponen paketnya
          const mergedIngredients = new Map<string, MenuBomIngredient>()
          let anyCompHasRecipe = false

          for (const comp of components) {
            const compResep = activeResepPerMenu.get(comp.menu_item_id)
            if (!compResep || !compResep.resep_item) continue
            anyCompHasRecipe = true

            for (const ri of (compResep as any).resep_item || []) {
              const bId = ri.bahan_baku_id
              const bObj = bahanMap.get(bId)
              const namaBahan = bObj?.nama || `Bahan #${bId.slice(0, 8)}`
              const satuan = ri.satuan || bObj?.satuan_kecil || bObj?.satuan || 'gr'
              const qtyPerPorsi = Number(ri.qty_per_porsi || 0) * comp.quantity
              const totalPemakaian = Math.round(menuInfo.totalPorsi * qtyPerPorsi * 100) / 100

              const existing = mergedIngredients.get(bId)
              if (existing) {
                existing.qty_per_porsi = Math.round((existing.qty_per_porsi + qtyPerPorsi) * 100) / 100
                existing.total_kebutuhan = Math.round((existing.total_kebutuhan + totalPemakaian) * 100) / 100
              } else {
                mergedIngredients.set(bId, {
                  bahan_baku_id: bId,
                  nama_bahan: namaBahan,
                  qty_per_porsi: qtyPerPorsi,
                  satuan,
                  total_kebutuhan: totalPemakaian,
                })
              }
            }
          }

          if (anyCompHasRecipe) {
            hasRecipe = true
            for (const ing of mergedIngredients.values()) {
              ingredients.push(ing)

              // Masukkan ke grouping pemakaian per bahan baku
              let list = menuUsageByBahan.get(ing.bahan_baku_id)
              if (!list) {
                list = []
                menuUsageByBahan.set(ing.bahan_baku_id, list)
              }
              list.push({
                menu_item_name: menuInfo.name,
                porsi_terjual: menuInfo.totalPorsi,
                qty_per_porsi: ing.qty_per_porsi,
                satuan: ing.satuan,
                total_pemakaian: ing.total_kebutuhan,
              })
            }
            ingredients.sort((a, b) => b.total_kebutuhan - a.total_kebutuhan)
          }
        } else if (hasDirectRecipe) {
          // Kasus Menu Single Biasa
          for (const ri of (directRecipe as any).resep_item || []) {
            const bId = ri.bahan_baku_id
            const bObj = bahanMap.get(bId)
            const namaBahan = bObj?.nama || `Bahan #${bId.slice(0, 8)}`
            const porsi = menuInfo.totalPorsi
            const qtyPerPorsi = Number(ri.qty_per_porsi || 0)
            const totalPemakaian = Math.round(porsi * qtyPerPorsi * 100) / 100
            const satuan = ri.satuan || bObj?.satuan_kecil || bObj?.satuan || 'gr'

            // Untuk grouping lama per bahan baku
            let list = menuUsageByBahan.get(bId)
            if (!list) {
              list = []
              menuUsageByBahan.set(bId, list)
            }
            list.push({
              menu_item_name: menuInfo.name,
              porsi_terjual: porsi,
              qty_per_porsi: qtyPerPorsi,
              satuan,
              total_pemakaian: totalPemakaian,
            })

            // Untuk breakdown terstruktur per menu (BOM)
            ingredients.push({
              bahan_baku_id: bId,
              nama_bahan: namaBahan,
              qty_per_porsi: qtyPerPorsi,
              satuan,
              total_kebutuhan: totalPemakaian,
            })
          }
          ingredients.sort((a, b) => b.total_kebutuhan - a.total_kebutuhan)
        }

        menuBreakdownList.push({
          menu_item_id: mid,
          menu_item_name: menuInfo.name,
          total_porsi: menuInfo.totalPorsi,
          has_recipe: hasRecipe,
          ingredients,
        })
      }

      menuBreakdownList.sort((a, b) => b.total_porsi - a.total_porsi)

      for (const list of menuUsageByBahan.values()) {
        list.sort((a, b) => b.total_pemakaian - a.total_pemakaian)
      }
    }
  }


  // Agregasi mutasi per pasangan (outlet, bahan) -- kunciOB. Mode outlet tunggal
  // hanya punya satu outlet, jadi hasilnya sama dengan agregasi per bahan dulu.
  interface AggOB {
    /** saldo_sebelum baris pertama periode (satuan kecil). */
    firstSaldoSebelum: number | null
    masukQty: number
    pakaiQty: number
    wasteQty: number
    mutasiLainQty: number
  }
  const movementOB = new Map<string, AggOB>()
  // Nilai masuk riil (harga surat jalan) tetap per bahan.
  const masukRiilByBahan = new Map<string, { total: number; hasRealPrice: boolean }>()
  // Nilai masuk per vendor (satuan kecil x harga SJ bila ada, else master) untuk label harga vendor.
  const nilaiVendorMasuk = new Map<string, Map<string, { qty: number; nilai: number; adaHargaSj: boolean }>>()
  const catatNilaiVendor = (bahanId: string, vendor: string, qty: number, nilai: number, adaHargaSj: boolean) => {
    let m = nilaiVendorMasuk.get(bahanId)
    if (!m) {
      m = new Map()
      nilaiVendorMasuk.set(bahanId, m)
    }
    const cur = m.get(vendor) || { qty: 0, nilai: 0, adaHargaSj: false }
    cur.qty += qty
    cur.nilai += nilai
    cur.adaHargaSj = cur.adaHargaSj || adaHargaSj
    m.set(vendor, cur)
  }

  for (const row of ledgerRows || []) {
    const oId = row.outlet_id || outletId
    const k = kunciOB(oId, row.bahan_baku_id)
    let agg = movementOB.get(k)
    if (!agg) {
      agg = {
        firstSaldoSebelum:
          row.saldo_sebelum !== null && row.saldo_sebelum !== undefined ? Number(row.saldo_sebelum) : null,
        masukQty: 0,
        pakaiQty: 0,
        wasteQty: 0,
        mutasiLainQty: 0,
      }
      movementOB.set(k, agg)
    }
    let riil = masukRiilByBahan.get(row.bahan_baku_id)
    if (!riil) {
      riil = { total: 0, hasRealPrice: false }
      masukRiilByBahan.set(row.bahan_baku_id, riil)
    }

    const rawQty = Number(row.qty || 0)
    const f = faktorPenuhMap.get(row.bahan_baku_id) || 1
    const hMaster = hargaMap.get(row.bahan_baku_id)?.harga_beli || 0
    const uMaster = f > 0 ? hMaster / f : hMaster

    // Aturan tipe -> kolom ada di lib/stok/klasifikasiMutasi (satu sumber).
    switch (klasifikasiMutasi(row, isAll)) {
      case 'order':
        // Potongan BOM & pembalik order batal dihitung neto lewat pakaiOrderOB (atribusi per order).
        break
      case 'pakai':
        agg.pakaiQty += Math.abs(rawQty)
        break
      case 'waste_manual':
        // Waste ber-ref_waste_id dihitung otoritatif dari stok_waste_reports (APPROVED).
        agg.wasteQty += Math.abs(rawQty)
        break
      case 'tolak_vendor': {
        // Koreksi / penolakan terima vendor drop-ship mengurangi masukQty yang sebelumnya tercatat
        const deductQty = Math.abs(rawQty)
        agg.masukQty = Math.max(0, agg.masukQty - deductQty)

        const vNama = vendorOf(row as any) || 'Vendor tidak tercatat'
        const vm = vendorMasukByBahan.get(row.bahan_baku_id)
        if (vm && vm.has(vNama)) {
          const nextV = Math.max(0, (vm.get(vNama) || 0) - deductQty)
          if (nextV > 0) vm.set(vNama, nextV)
          else vm.delete(vNama)
        }
        riil.total = Math.max(0, riil.total - deductQty * uMaster)
        catatNilaiVendor(row.bahan_baku_id, vNama, -deductQty, -deductQty * uMaster, false)
        break
      }
      case 'masuk': {
        const addQty = Math.abs(rawQty)
        agg.masukQty += addQty

        const vNama = vendorOf(row as any) || 'Vendor tidak tercatat'
        let vm = vendorMasukByBahan.get(row.bahan_baku_id)
        if (!vm) {
          vm = new Map()
          vendorMasukByBahan.set(row.bahan_baku_id, vm)
        }
        vm.set(vNama, (vm.get(vNama) || 0) + addQty)

        // Nilai riil per satuan kecil dari nilai dokumen surat jalan (lihat hargaKecilSjRekon).
        const uRiil = hargaKecilWajar(hargaKecilSjRekon(row), uMaster)
        if (uRiil !== null) {
          riil.total += addQty * uRiil
          riil.hasRealPrice = true
          catatNilaiVendor(row.bahan_baku_id, vNama, addQty, addQty * uRiil, true)
        } else {
          riil.total += addQty * uMaster
          catatNilaiVendor(row.bahan_baku_id, vNama, addQty, addQty * uMaster, false)
        }
        break
      }
      case 'lain':
        // transfer antar cabang, retur (ke pusat / ke vendor), penyesuaian internal
        // (ayam matang/koreksi), dan tipe yang belum dikenal -- bertanda.
        agg.mutasiLainQty += rawQty
        break
      case 'abaikan':
        break
    }
  }

  // Harga rata-rata pemakaian per satuan kecil (FIFO) per bahan; null = tak ada data
  // pemakaian -> pemanggil memakai master.
  const hargaPakaiKecilOf = (bId: string): number | null => {
    const nv = nilaiVendorPakai.get(bId)
    if (!nv) return null
    let qty = 0
    let nilai = 0
    for (const v of nv.values()) {
      qty += v.qty
      nilai += v.nilai
    }
    return qty > 0 ? nilai / qty : null
  }

  // Biaya bahan menurut resep (teoritis) = kebutuhan resep x harga master per satuan kecil
  // (skala yang sama dengan pakai_rp, jadi selisih aktual vs resep murni selisih jumlah).
  // Baris tanpa harga master (unit price 0) dilewati & dihitung jumlahnya.
  let teoritisPakaiRp = 0
  let teoritisTidakTerhitung = 0
  {
    const bahanById = new Map(bahanList.map((b) => [b.id, b]))
    for (const mb of menuBreakdownList) {
      for (const ing of mb.ingredients) {
        const b = bahanById.get(ing.bahan_baku_id)
        const h = hargaMap.get(ing.bahan_baku_id)
        const kemasan = Number(b?.faktor_tampilan) || Number(h?.kemasan_qty) || 1
        const unit = kemasan > 0 ? (h?.harga_beli || 0) / kemasan : 0
        // Potongan stok BOM selalu dalam satuan kecil bahan; label satuan resep (mis. "pcs",
        // "lembar") hanya penamaan -- jadi tidak dipakai untuk menolak baris.
        if (b && unit > 0) {
          teoritisPakaiRp += ing.total_kebutuhan * unit
        } else {
          teoritisTidakTerhitung++
        }
      }
    }
    teoritisPakaiRp = Math.round(teoritisPakaiRp)
  }

  // 6. Susun tabel rekonsiliasi item per item
  const reconciliationItems: ReconciliationItem[] = []

  let totalAwalRp = 0
  let totalMasukRpMaster = 0
  let totalMasukRpRiil = 0
  let totalPakaiRp = 0
  let totalPakaiRpRiil = 0
  let totalMutasiLainRp = 0
  let totalWasteRp = 0
  let totalSistemRp = 0
  let totalFisikRp = 0
  let totalSelisihRp = 0
  let berselisihCount = 0
  let anomaliSkalaCount = 0
  let ekstremCount = 0

  for (const b of bahanList) {
    const hargaRow = hargaMap.get(b.id)
    const hargaMaster = hargaRow?.harga_beli || 0
    const kemasanQty = Number(b.faktor_tampilan) || Number(hargaRow?.kemasan_qty) || 1
    const unitPriceKecil = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster

    // Posisi per outlet lalu digabung (lib/stok/rekonsiliasiOutlet):
    // - Saldo Awal per outlet: hitungan fisik opname sebelumnya, atau -- bila outlet itu
    //   tidak menghitung bahan ini / belum pernah opname -- saldo ledger sebelum mutasi
    //   pertama periode (dulu outlet ber-opname yang tak menghitung bahan ini menyumbang 0).
    // - Stok Sistem = Awal + Masuk - Pakai - Waste + Mutasi Lain, dijumlah semua outlet.
    // - Selisih hanya dari outlet yang menghitung fisik bahan ini (fisik vs sistem outlet
    //   yang sama). Stok outlet yang tidak opname tetap terlihat di Stok Sistem.
    // Pembalik order yang potongannya terjadi sebelum periode tidak dihitung di sini:
    // Saldo Awal sudah hasil hitung fisik, jadi pembalik itu bukan barang masuk.
    const posisi: PosisiOutletBahan[] = []
    for (const oId of targetOutletIds) {
      const k = kunciOB(oId, b.id)
      const agg = movementOB.get(k)
      const adaData =
        !!agg || pakaiOrderOB.has(k) || approvedWasteOB.has(k) || prevFisikOB.has(k) || fisikPenutupOB.has(k)
      if (!adaData) continue
      posisi.push({
        saldoAwal: saldoAwalOutlet(prevFisikOB.get(k), agg?.firstSaldoSebelum),
        masuk: agg?.masukQty || 0,
        pakai: (agg?.pakaiQty || 0) + (pakaiOrderOB.get(k) || 0),
        waste: (approvedWasteOB.get(k) || 0) + (agg?.wasteQty || 0),
        mutasiLain: agg?.mutasiLainQty || 0,
        fisik: fisikPenutupOB.get(k) ?? null,
      })
    }
    const gab = gabungPosisiOutlet(posisi)

    const saldoAwal = gab.saldoAwal
    const masukQty = gab.masuk
    const pakaiQty = gab.pakai
    const wasteQty = gab.waste
    const mutasiLainQty = gab.mutasiLain
    const stokSistem = gab.stokSistem
    // Stok Fisik dari opname (jika tidak ada opname, tetap null dan jangan dipalsukan dari saldo sistem!)
    const stokFisik = gab.stokFisik
    // Selisih = Fisik - Sistem (outlet yang sama)
    const selisihQty = gab.selisih
    const stokSistemTerhitung = gab.stokSistemTerhitung
    const riil = masukRiilByBahan.get(b.id)

    // Valuasi Rupiah
    const saldoAwalRp = Math.round(saldoAwal * unitPriceKecil)
    const masukRpMaster = Math.round(masukQty * unitPriceKecil)
    const masukRpRiil = riil?.hasRealPrice ? Math.round(riil.total) : masukRpMaster
    // pakai_rp memakai harga master -- skala yang sama dengan saldo awal, masuk, waste,
    // dan stok sistem, sehingga kartu Saldo Awal + Masuk - Pakai - Waste +/- Lain = Stok
    // Sistem tetap utuh. Nilai menurut harga kiriman yang stoknya terpakai (FIFO, sama
    // dengan timeline) dilaporkan terpisah sebagai pakai_rp_riil -- pola masuk_rp_riil.
    const pakaiRp = Math.round(pakaiQty * unitPriceKecil)
    const pakaiRpRiil = Math.round(pakaiQty * (hargaPakaiKecilOf(b.id) ?? unitPriceKecil))
    const wasteRp = Math.round(wasteQty * unitPriceKecil)
    const mutasiLainRp = Math.round(mutasiLainQty * unitPriceKecil)
    const stokSistemRp = Math.round(stokSistem * unitPriceKecil)
    const stokFisikRp = stokFisik !== null ? Math.round(stokFisik * unitPriceKecil) : null
    const stokSistemTerhitungRp =
      stokSistemTerhitung !== null ? Math.round(stokSistemTerhitung * unitPriceKecil) : null
    const selisihRp = stokFisik !== null ? Math.round(selisihQty * unitPriceKecil) : 0

    // Diagnostik Anomali
    const diagnostics: DiagnosticAlert[] = []

    // 1. Selisih pas kelipatan isi kemasan (tepat 1 tabung / 1 Dus). Jarang salah skala;
    // lebih sering salah hitung atau barang dicatat di bahan yang salah -- lihat
    // lib/stok/diagnosaSelisih.ts. Kode tipe tetap ANOMALI_SKALA (dipakai ekspor).
    if (stokFisik !== null && isKelipatanKemasan(selisihQty, kemasanQty)) {
      const estUnitBesar = Math.round(Math.abs(selisihQty) / kemasanQty)
      diagnostics.push({
        type: 'ANOMALI_SKALA',
        severity: 'danger',
        message: `Selisih pas ${selisihQty > 0 ? '+' : '-'}${estUnitBesar} ${b.satuan}. Cek salah hitung (mis. barang kosong/cadangan ikut atau tidak dihitung) atau salah pilih bahan.`,
      })
      anomaliSkalaCount++
    }

    // 2. Deteksi Pemakaian POS vs Resep
    if (masukQty > 0 && pakaiQty === 0 && (b.kategori === 'FOOD & BEVERAGE' || b.kategori === 'BUMBU')) {
      diagnostics.push({
        type: 'BOM_MISMATCH',
        severity: 'warning',
        message: 'Bahan masuk & ada di outlet tapi pemakaian penjualan 0. Periksa mapping resep menu POS.',
      })
    }

    // 3. Deteksi Surat Jalan Gantung
    if (pendingSjCount > 0 && masukQty === 0) {
      diagnostics.push({
        type: 'SJ_GANTUNG',
        severity: 'info',
        message: `Terdapat ${pendingSjCount} Surat Jalan belum diverifikasi yang mungkin belum masuk ke stok ini.`,
      })
    }

    // 4. Peringatan Kerugian / Deviasi Nominal Ekstrem (>= Rp 50.000)
    if (Math.abs(selisihRp) >= 50000) {
      diagnostics.push({
        type: 'NOMINAL_EKSTREM',
        severity: 'danger',
        message: `Deviasi nominal tinggi (${selisihRp < 0 ? 'Kerugian' : 'Surplus'} Rp ${Math.abs(selisihRp).toLocaleString('id-ID')}).`,
      })
      ekstremCount++
    }

    if (Math.abs(selisihQty) > 0.01) {
      berselisihCount++
    }

    totalAwalRp += saldoAwalRp
    totalMasukRpMaster += masukRpMaster
    totalMasukRpRiil += masukRpRiil
    totalPakaiRp += pakaiRp
    totalPakaiRpRiil += pakaiRpRiil
    totalWasteRp += wasteRp
    totalMutasiLainRp += mutasiLainRp
    totalSistemRp += stokSistemRp
    if (stokFisikRp !== null) totalFisikRp += stokFisikRp
    totalSelisihRp += selisihRp

    const hasOpname = stokFisik !== null && stokFisik !== undefined
    let status: 'MATCH' | 'MINUS' | 'SURPLUS' | 'TIDAK_OPNAME' = 'TIDAK_OPNAME'
    let selisihPersen: number | null = null

    if (hasOpname) {
      if (Math.abs(selisihQty) <= 0.01) {
        status = 'MATCH'
      } else if (selisihQty < -0.01) {
        status = 'MINUS'
      } else {
        status = 'SURPLUS'
      }

      // Persen terhadap stok sistem outlet yang dihitung (= stok sistem untuk outlet tunggal).
      const basisPersen = stokSistemTerhitung ?? stokSistem
      if (basisPersen !== 0) {
        selisihPersen = Math.round((selisihQty / Math.abs(basisPersen)) * 1000) / 10
      }
    }

    reconciliationItems.push({
      bahan_baku_id: b.id,
      nama: b.nama,
      kategori: b.kategori,
      satuan: b.satuan,
      satuan_tengah: b.satuan_tengah,
      faktor_tengah: b.faktor_tengah,
      satuan_kecil: b.satuan_kecil,
      faktor_tampilan: b.faktor_tampilan,
      harga_beli_master: hargaMaster,
      unit_price_kecil: unitPriceKecil,
      satuan_kirim: b.satuan_distribusi?.trim() || b.satuan,
      harga_master_kirim: (() => {
        const f = getDistribusiFactor(b as any)
        return f > 0 ? hargaMaster / f : hargaMaster
      })(),
      saldo_awal_qty: saldoAwal,
      masuk_qty: masukQty,
      pakai_qty: pakaiQty,
      waste_qty: wasteQty,
      mutasi_lain_qty: mutasiLainQty,
      stok_sistem_qty: stokSistem,
      stok_fisik_qty: stokFisik,
      selisih_qty: selisihQty,
      stok_sistem_terhitung_qty: stokSistemTerhitung,
      stok_sistem_terhitung_rp: stokSistemTerhitungRp,
      outlet_opname_count: gab.outletOpname,
      outlet_total_count: gab.outletTotal,
      saldo_awal_rp: saldoAwalRp,
      masuk_rp_master: masukRpMaster,
      masuk_rp_riil: masukRpRiil,
      pakai_rp: pakaiRp,
      pakai_rp_riil: pakaiRpRiil,
      waste_rp: wasteRp,
      mutasi_lain_rp: mutasiLainRp,
      stok_sistem_rp: stokSistemRp,
      stok_fisik_rp: stokFisikRp,
      selisih_rp: selisihRp,
      has_opname: hasOpname,
      status,
      selisih_persen: selisihPersen,
      diagnostics,
      vendor_masuk: Array.from(vendorMasukByBahan.get(b.id)?.entries() || [])
        .map(([vendor_nama, qty]) => {
          // Harga per satuan kirim = rata-rata per satuan kecil x (faktor penuh / faktor distribusi),
          // skala yang sama dengan harga_master_kirim.
          const nv = nilaiVendorMasuk.get(b.id)?.get(vendor_nama)
          const fPenuh = faktorPenuhMap.get(b.id) || 1
          const fDist = getDistribusiFactor(b as any)
          const harga_kirim =
            nv && nv.adaHargaSj && nv.qty > 0 && fDist > 0 ? (nv.nilai / nv.qty) * (fPenuh / fDist) : null
          return { vendor_nama, qty, harga_kirim }
        })
        .sort((a, c) => c.qty - a.qty),
      vendor_pakai: Array.from(vendorPakaiByBahan.get(b.id)?.entries() || [])
        .map(([vendor_nama, qty]) => {
          // Skala yang sama dengan harga_master_kirim (per satuan kirim).
          const nv = nilaiVendorPakai.get(b.id)?.get(vendor_nama)
          const fPenuh = faktorPenuhMap.get(b.id) || 1
          const fDist = getDistribusiFactor(b as any)
          const harga_kirim =
            nv && nv.adaHargaSj && nv.qty > 0 && fDist > 0 ? (nv.nilai / nv.qty) * (fPenuh / fDist) : null
          return { vendor_nama, qty, harga_kirim }
        })
        .sort((a, c) => c.qty - a.qty),
      menu_usages: menuUsageByBahan.get(b.id) || [],
    })
  }

  // Bahan sejenis dengan selisih berlawanan (FOIL 5M kurang, FOIL 7,6M lebih, dst.):
  // pola barang yang dihitung di bawah nama bahan yang salah.
  let tukarBahanCount = 0
  if (!isAll) {
    let pasanganSubstitusi: [string, string][] = []
    try {
      const { data: subs } = await supabase
        .from('bahan_baku_substitusi')
        .select('bahan_baku_utama_id, bahan_baku_pengganti_id')
      pasanganSubstitusi = (subs || []).map((x: any) => [x.bahan_baku_utama_id, x.bahan_baku_pengganti_id])
    } catch (e) {
      console.warn('Gagal memuat pasangan substitusi:', e)
    }
    const tukar = cariTukarBahan(
      reconciliationItems
        .filter((it) => it.has_opname && Math.abs(it.selisih_qty) > 0.01)
        .map((it) => ({
          id: it.bahan_baku_id,
          nama: it.nama,
          satuan: it.satuan,
          selisih: it.selisih_qty,
          kemasan: faktorPenuhMap.get(it.bahan_baku_id) || 1,
        })),
      pasanganSubstitusi
    )
    for (const it of reconciliationItems) {
      const pasangan = tukar.get(it.bahan_baku_id)
      if (!pasangan) continue
      tukarBahanCount++
      const daftar = pasangan
        .map((p) => {
          const besar = p.kemasan > 1 ? Math.round((p.selisih / p.kemasan) * 10) / 10 : p.selisih
          return `${p.nama} (${p.selisih > 0 ? '+' : ''}${besar.toLocaleString('id-ID')} ${p.satuan})`
        })
        .join(', ')
      it.diagnostics.unshift({
        type: 'TUKAR_BAHAN',
        severity: 'danger',
        message: `Selisih berlawanan dengan ${daftar}. Kemungkinan dihitung/dicatat di bahan yang salah.`,
      })
    }
  }

  return {
    outlet: { id: isAll ? 'ALL' : outletId, name: outletName },
    period: {
      mode: isAll ? 'date_range' : params.mode,
      opname_terpilih: opnameTerpilih,
      opname_sebelumnya: opnameSebelumnya,
      start_date: startIso,
      end_date: endIso,
      tanggal_mulai: tanggalMulai,
      tanggal_akhir: tanggalAkhir,
      jendela_outlet: Object.fromEntries(jendelaOutlet),
    },
    pending_surat_jalan_count: pendingSjCount,
    items: reconciliationItems,
    totals: {
      total_awal_rp: totalAwalRp,
      total_masuk_rp_master: totalMasukRpMaster,
      total_masuk_rp_riil: totalMasukRpRiil,
      total_pakai_rp: totalPakaiRp,
      total_pakai_rp_riil: totalPakaiRpRiil,
      total_mutasi_lain_rp: totalMutasiLainRp,
      total_waste_rp: totalWasteRp,
      total_sistem_rp: totalSistemRp,
      total_fisik_rp: totalFisikRp,
      total_selisih_rp: totalSelisihRp,
      bahan_berselisih_count: berselisihCount,
      anomali_skala_count: anomaliSkalaCount,
      tukar_bahan_count: tukarBahanCount,
      ekstrem_count: ekstremCount,
      omzet_rp: omzetRp,
      potongan_rp: potonganRp,
      order_count: completedOrderIds.length,
      teoritis_pakai_rp: teoritisPakaiRp,
      teoritis_tidak_terhitung: teoritisTidakTerhitung,
    },
    menu_breakdown: menuBreakdownList,
    audit_note: isAll ? null : auditNote,
  }
}


/**
 * Mengambil buku jurnal transaksi kronologis untuk satu bahan baku spesifik
 */
export async function fetchItemTransactionLedger(
  outletId: string,
  bahanBakuId: string,
  startDate: string,
  endDate: string,
  /**
   * Mode Semua Outlet + Rentang Tanggal: jendela tiap outlet dari snapshot
   * (period.jendela_outlet). Outlet tunggal cukup startDate/endDate (sudah
   * persis jendela outlet itu).
   */
  jendelaOutlet?: Record<string, JendelaWaktu>
): Promise<LedgerTimelineRow[]> {
  const isAll = outletId === 'ALL'
  await requireManagementAuth(isAll ? undefined : outletId)
  const supabase = makeServiceClient()

  let targetOutletIds: string[] = []
  const outletNameMap = new Map<string, string>()

  if (isAll) {
    const accessibleOutlets = await fetchAccessibleOutlets()
    const { data: outletMeta } = accessibleOutlets.length > 0
      ? await supabase.from('outlets').select('id, name, type').in('id', accessibleOutlets.map((o) => o.id))
      : { data: [] as any[] }
    const typeMap = new Map((outletMeta || []).map((o: any) => [o.id, o.type]))
    const retailOutlets = accessibleOutlets.filter((o) =>
      isRetailSalesOutlet({ name: o.name, type: typeMap.get(o.id) })
    )
    const chosenOutlets = retailOutlets.length > 0 ? retailOutlets : accessibleOutlets
    targetOutletIds = chosenOutlets.map((o) => o.id)
    chosenOutlets.forEach((o) => outletNameMap.set(o.id, o.name))
  } else {
    targetOutletIds = [outletId]
  }

  // Jendela per outlet (Semua Outlet, mode Rentang Tanggal); outlet yang tak ada di
  // peta memakai startDate/endDate. null = satu jendela untuk semua.
  const jendelaPerOutlet: Map<string, JendelaWaktu> | null =
    isAll && jendelaOutlet && Object.keys(jendelaOutlet).length > 0
      ? new Map(
          targetOutletIds.map((oId) => {
            const j = jendelaOutlet[oId]
            return [oId, j ? { start: j.start, end: j.end } : { start: startDate, end: endDate }] as [string, JendelaWaktu]
          })
        )
      : null

  // Ambil data bahan baku, harga, dan penanda skala saldo untuk konversi harga & qty per unit
  const [bahanRes, hargaRes, balanceScaleRes] = await Promise.all([
    supabase
      .from('bahan_baku')
      .select('id, nama, satuan, satuan_kecil, faktor_tampilan, faktor_konversi')
      .eq('id', bahanBakuId)
      .single(),
    supabase
      .from('bahan_baku_harga')
      .select('harga_beli, kemasan_qty')
      .eq('bahan_baku_id', bahanBakuId)
      .maybeSingle(),
    (isAll
      ? supabase
          .from('stok_balance')
          .select('outlet_id, saldo_is_gram')
          .eq('bahan_baku_id', bahanBakuId)
          .eq('saldo_is_gram', false)
          .in('outlet_id', targetOutletIds)
      : supabase
          .from('stok_balance')
          .select('outlet_id, saldo_is_gram')
          .eq('bahan_baku_id', bahanBakuId)
          .eq('saldo_is_gram', false)
          .eq('outlet_id', outletId)
    ),
  ])

  const bahan = bahanRes.data
  const kemasanQty =
    Number(bahan?.faktor_tampilan) ||
    Number((bahan as any)?.faktor_konversi) ||
    Number(hargaRes.data?.kemasan_qty) ||
    1
  const hargaMaster = Number(hargaRes.data?.harga_beli) || 0
  const unitPrice = kemasanQty > 0 ? hargaMaster / kemasanQty : hargaMaster
  const notGramOutlets = new Set<string>((balanceScaleRes.data || []).map((sb: any) => sb.outlet_id))

  // Query seluruh baris ledger_stok -- WAJIB berhalaman: mode Semua Outlet bisa
  // ±1.400 baris per bahan per hari, dan satu request polos dipotong PostgREST di
  // 1.000 baris TANPA error (timeline & saldo berjalan kehilangan baris terbaru).
  // Urutan unik created_at + id agar batas halaman stabil.
  const buildTimelineQuery = () => {
    const q = supabase
      .from('ledger_stok')
      .select(`
      id,
      outlet_id,
      created_at,
      tipe,
      catatan,
      qty,
      saldo_sebelum,
      saldo_sesudah,
      ref_shipment_id,
      ref_order_id,
      ref_opname_id,
      ref_transfer_id,
      ref_terima_vendor_id,
      ref_po_id
    `)
      .eq('bahan_baku_id', bahanBakuId)
    const terfilter = jendelaPerOutlet
      ? q.in('outlet_id', targetOutletIds).or(filterOrJendela(jendelaPerOutlet, 'created_at'))
      : (isAll ? q.in('outlet_id', targetOutletIds) : q.eq('outlet_id', outletId))
          .gte('created_at', startDate)
          .lte('created_at', endDate)
    return terfilter
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
  }

  let rawRows: any[]
  try {
    rawRows = await fetchAllPages<any>(buildTimelineQuery)
  } catch (e: any) {
    throw new Error(`Gagal memuat timeline mutasi: ${e?.message ?? e}`)
  }

  const rows = (rawRows || []).map((r: any) => {
    const oId = r.outlet_id || outletId
    if (!notGramOutlets.has(oId) || kemasanQty <= 1) return r
    return {
      ...r,
      qty: r.qty !== null && r.qty !== undefined ? Number(r.qty) * kemasanQty : r.qty,
      saldo_sebelum:
        r.saldo_sebelum !== null && r.saldo_sebelum !== undefined ? Number(r.saldo_sebelum) * kemasanQty : r.saldo_sebelum,
      saldo_sesudah:
        r.saldo_sesudah !== null && r.saldo_sesudah !== undefined ? Number(r.saldo_sesudah) * kemasanQty : r.saldo_sesudah,
    }
  })

  // Kumpulkan reference IDs untuk lookup nomor dokumen
  const shipmentIds = [...new Set((rows || []).map((r) => r.ref_shipment_id).filter((v): v is string => !!v))]
  const orderIds = [...new Set((rows || []).map((r) => r.ref_order_id).filter((v): v is string => !!v))]

  // Per potongan 200 id: ribuan order (mode Semua Outlet) melewati batas 1.000 baris
  // dan panjang URL bila diminta sekaligus.
  const ambilPerPotongan = async (table: string, cols: string, ids: string[]): Promise<any[]> => {
    const out: any[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from(table).select(cols).in('id', ids.slice(i, i + 200))
      if (data) out.push(...data)
    }
    return out
  }
  const [shipmentsData, ordersData] = await Promise.all([
    ambilPerPotongan('surat_jalan', 'id, document_number', shipmentIds),
    ambilPerPotongan('orders', 'id, order_number', orderIds),
  ])

  const sjDocMap = new Map(shipmentsData.map((s: any) => [s.id, s.document_number]))
  const orderDocMap = new Map(ordersData.map((o: any) => [o.id, `#${o.order_number}`]))

  // Vendor & harga beku surat jalan untuk bahan ini: itulah harga sebenarnya barang yang
  // dikirim/diterima (harga master = harga pembelian terakhir, bisa dari vendor lain).
  const sjItemsByKey = await fetchItemSuratJalan(supabase, shipmentIds, [bahanBakuId])
  const sjVendorIds = [
    ...new Set([...sjItemsByKey.values()].flat().map((x) => x.vendor_id).filter((v): v is string => !!v)),
  ]
  const sjVendorName = new Map<string, string>()
  if (sjVendorIds.length > 0) {
    const { data: sup } = await supabase.from('supplier').select('id, nama').in('id', sjVendorIds)
    for (const s of sup || []) sjVendorName.set(s.id, vendorLabel(s.nama) || s.nama)
  }
  const sjItemsOf = (sjId: string | null | undefined): ItemSuratJalan[] | undefined => {
    if (!sjId) return undefined
    const items = sjItemsByKey.get(`${sjId}_${bahanBakuId}`)
    return items?.map((x) => ({ ...x, vendor: x.vendor_id ? sjVendorName.get(x.vendor_id) || null : null }))
  }
  const sjRingkas = new Map(
    shipmentIds.flatMap((id) => {
      const items = sjItemsOf(id)
      return items ? [[id, ringkasItemSuratJalan(items)] as const] : []
    })
  )

  // Harga per satuan kecil tiap baris surat jalan = nilai dokumen (qty dok x harga dok)
  // dibagi qty satuan kecil baris. Bila satu surat jalan menulis beberapa baris
  // (tipe & outlet sama, mis. dipecah per vendor), nilai dibagi sebanding qty.
  const grupSj = new Map<string, number>()
  for (const r of rows || []) {
    if (!r.ref_shipment_id) continue
    const k = `${r.ref_shipment_id}|${r.tipe}|${r.outlet_id}`
    grupSj.set(k, (grupSj.get(k) || 0) + Math.abs(Number(r.qty || 0)))
  }
  const hargaKecilSjOf = (r: any): number | null => {
    const items = sjItemsOf(r.ref_shipment_id)
    if (!items) return null
    const nilai = nilaiDokumenSuratJalan(items, r.tipe)
    const totalQty = grupSj.get(`${r.ref_shipment_id}|${r.tipe}|${r.outlet_id}`) || 0
    return hargaKecilWajar(hargaKecilDariNilai(nilai, totalQty), unitPrice)
  }

  const vendorOf = await resolveVendorNames(
    supabase,
    (rows || []).map((r: any) => ({ ...r, bahan_baku_id: bahanBakuId }))
  )

  const menuTerjual = await resolveMenuTerjual(
    supabase,
    outletId,
    bahanBakuId,
    (rows || []).map((r: any) => ({ id: r.id, tipe: r.tipe, qty: Number(r.qty || 0), ref_order_id: r.ref_order_id }))
  )

  // Saldo awal gabungan = saldo sebelum mutasi pertama TIAP outlet (dulu hanya baris
  // pertama satu outlet).
  const saldoAwalPerOutlet = new Map<string, number>()
  for (const r of rows || []) {
    const oId = r.outlet_id || outletId
    if (!saldoAwalPerOutlet.has(oId)) saldoAwalPerOutlet.set(oId, Number(r.saldo_sebelum || 0))
  }
  let openingBalance = 0
  for (const v of saldoAwalPerOutlet.values()) openingBalance += Math.max(v, 0)

  const awalTimeline = jendelaPerOutlet
    ? new Map([...jendelaPerOutlet].map(([oId, j]) => [oId, j.start] as [string, string]))
    : startDate
  const priorByBahan = await fetchPriorInflows(supabase, isAll ? targetOutletIds : outletId, awalTimeline, [bahanBakuId], {
    kebutuhan: new Map([[bahanBakuId, openingBalance]]),
    kunci: () => bahanBakuId,
    normalisasi: (r: any) =>
      notGramOutlets.has(r.outlet_id || outletId) && kemasanQty > 1 ? { ...r, qty: Number(r.qty) * kemasanQty } : r,
  })
  const fifo = attributeFifo({
    openingBalance,
    // Lapisan sebelum periode: harga dokumen yang tak wajar (salah satuan) jatuh ke master.
    priorInflowsNewestFirst: (priorByBahan.get(bahanBakuId) || []).map((l) => ({
      ...l,
      harga: hargaKecilWajar(l.harga ?? null, unitPrice),
    })),
    windowRows: (rows || []).map((r: any) => ({
      id: r.id,
      qty: Number(r.qty || 0),
      vendor: Number(r.qty) > 0 ? vendorOf({ ...r, bahan_baku_id: bahanBakuId }) : null,
      // Lapisan masuk membawa harga kirimannya, supaya pemakaian sesudahnya dinilai
      // dengan harga barang yang benar-benar terpakai (mis. TIS FOOD Rp105rb), bukan master.
      harga: Number(r.qty) > 0 ? hargaKecilSjOf(r) : null,
    })),
  })

  return (rows || []).map((r: any) => {
    const qty = Number(r.qty || 0)
    const isMasuk = qty > 0
    const sj = r.ref_shipment_id ? sjRingkas.get(r.ref_shipment_id) : undefined
    const hargaSjKecil = hargaKecilSjOf(r)
    // Vendor tercatat di surat jalan menang atas tebakan FIFO.
    const vendorSj = sj?.vendor ?? null
    // Barang keluar tanpa surat jalan (pemakaian, waste, dst): dinilai dengan harga
    // lapisan FIFO yang dikonsumsinya; bagian tanpa harga kiriman jatuh ke master.
    const partsFifo = !isMasuk && !vendorSj && hargaSjKecil === null ? fifo.get(r.id) : undefined
    const hargaFifoKecil = partsFifo ? hargaRataFifo(partsFifo) : null
    const nilaiRp = partsFifo && partsFifo.length > 0
      ? nilaiFifoRp(partsFifo, unitPrice)
      : nilaiBarisRp(qty, hargaSjKecil, unitPrice)
    const debetRp = isMasuk ? nilaiRp : 0
    const kreditRp = !isMasuk ? nilaiRp : 0
    const saldoSesudah = Number(r.saldo_sesudah || 0)
    const saldoSesudahRp = Math.round(saldoSesudah * unitPrice)

    let docNumber: string | null = null
    if (r.ref_shipment_id) docNumber = sjDocMap.get(r.ref_shipment_id) || 'SJ'
    else if (r.ref_order_id) docNumber = orderDocMap.get(r.ref_order_id) || 'Order'
    else if (r.ref_opname_id) docNumber = 'Opname'

    const rOutletName = outletNameMap.get(r.outlet_id)
    const formattedCatatan = isAll && rOutletName
      ? (r.catatan ? `[${rOutletName}] ${r.catatan}` : `[${rOutletName}]`)
      : r.catatan

    return {
      id: r.id,
      created_at: r.created_at,
      tipe: r.tipe,
      catatan: formattedCatatan,
      qty,
      harga_satuan: qty !== 0 ? nilaiRp / Math.abs(qty) : unitPrice,
      // Dinyatakan per satuan besar SEKARANG (harga kecil x kemasan saat ini) untuk label.
      harga_sj_besar: hargaSjKecil !== null ? hargaSjKecil * kemasanQty : null,
      harga_fifo_besar: hargaFifoKecil !== null ? hargaFifoKecil * kemasanQty : null,
      debet_rp: debetRp,
      kredit_rp: kreditRp,
      saldo_sesudah_qty: saldoSesudah,
      saldo_sesudah_rp: saldoSesudahRp,
      ref_shipment_id: r.ref_shipment_id,
      ref_order_id: r.ref_order_id,
      ref_opname_id: r.ref_opname_id,
      ref_transfer_id: r.ref_transfer_id,
      ref_doc_number: docNumber,
      menu_terjual: menuTerjual.get(r.id) || null,
      vendor_estimasi: qty < 0 && !vendorSj ? labelFifo(fifo.get(r.id)) : null,
      vendor_nama: vendorSj || (qty > 0 ? vendorOf({ ...r, bahan_baku_id: bahanBakuId }) : null),
    }
  })
}

/**
 * Menyimpan catatan temuan audit manajemen pada sesi opname
 */
export async function saveOpnameAuditNote(opnameId: string, note: string): Promise<void> {
  const { staff } = await requireManagementAuth()
  const supabase = makeServiceClient()

  const formattedNote = `[Audit Manajemen ${staff.name} - ${new Date().toLocaleString('id-ID')}]: ${note}`

  const { error } = await supabase
    .from('opname')
    .update({
      notes: formattedNote,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opnameId)

  if (error) throw new Error(`Gagal menyimpan catatan audit: ${error.message}`)
}

/**
 * Mengambil detail bukti transaksi untuk modal pop-up (Surat Jalan, Waste, atau Order POS)
 */
export async function fetchProofDetails(type: 'surat_jalan' | 'waste' | 'order', id: string) {
  await requireManagementAuth()
  const supabase = makeServiceClient()

  if (type === 'surat_jalan') {
    const { data, error } = await supabase
      .from('surat_jalan')
      .select(`
        id,
        document_number,
        status,
        created_at,
        auto_verified_at,
        notes,
        outlets(name),
        surat_jalan_item(
          id,
          qty_dikirim,
          qty_terima,
          harga_snapshot,
          bahan_baku(nama, satuan)
        )
      `)

      .eq('id', id)
      .single()

    if (error) throw new Error(`Gagal memuat detail surat jalan: ${error.message}`)
    return { type: 'surat_jalan', data }
  }

  if (type === 'waste') {
    const { data, error } = await supabase
      .from('stok_waste_reports')
      .select(`
        id,
        qty,
        reason,
        photo_url,
        status,
        created_at,
        reported_by_staff:outlet_staff!reported_by(name),
        approved_by_staff:outlet_staff!approved_by(name),
        bahan_baku(nama, satuan)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Gagal memuat detail waste: ${error.message}`)
    return { type: 'waste', data }
  }

  if (type === 'order') {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        total_amount,
        order_items(id, menu_item_name, quantity, unit_price)
      `)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(`Gagal memuat detail order: ${error.message}`)
    return { type: 'order', data }
  }

  throw new Error('Tipe bukti tidak valid')
}

export interface DailySummaryCardEntry {
  date: string
  totals: ReconciliationTotals
}

/**
 * Mengambil breakdown harian nilai kartu ringkasan untuk mode Rentang Tanggal,
 * sehingga setiap tanggal dihitung terpisah tanpa dijumlahkan antar hari.
 */
export async function fetchDailySummaryCardsBreakdown(
  outletId: string,
  startDate: string,
  endDate: string
): Promise<DailySummaryCardEntry[]> {
  if (!startDate || !endDate) {
    throw new Error('Tanggal awal dan tanggal akhir wajib diisi')
  }
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const cur = new Date(Date.UTC(sy, sm - 1, sd))
  const end = new Date(Date.UTC(ey, em - 1, ed))
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    throw new Error('Rentang tanggal tidak valid')
  }

  const dates: string[] = []
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  if (dates.length > 62) {
    throw new Error('Maksimal rentang tanggal untuk breakdown harian adalah 62 hari')
  }

  const results: DailySummaryCardEntry[] = []
  const chunkSize = 5
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize)
    const snapshots = await Promise.all(
      chunk.map(async (date) => {
        const snap = await fetchReconciliationSnapshot(outletId, {
          mode: 'date_range',
          startDate: date,
          endDate: date,
        })
        return { date, totals: snap.totals }
      })
    )
    results.push(...snapshots)
  }

  return results
}
