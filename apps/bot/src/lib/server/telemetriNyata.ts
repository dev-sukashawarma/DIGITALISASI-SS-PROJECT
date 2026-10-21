import { createClient } from '@supabase/supabase-js'

export interface OutletTelemetri {
  id: string
  nama: string
  type: string
  omzet: number
  orderCount: number
}

export interface StafCutiTelemetri {
  nama: string
  role: string
  jenis: string
  status: string
  alasan: string
}

export interface StafTelatTelemetri {
  nama: string
  outlet: string
  telatMenit: number
}

export interface WasteItemTelemetri {
  nama: string
  satuan: string
  totalQty: number
  frekuensi: number
  alasanDominan: string
  estKerugianRp: number
}

export interface WasteOutletTelemetri {
  nama: string
  frekuensi: number
  totalQty: number
}

export interface WasteTelemetri {
  totalLaporan30Hari: number
  totalEstKerugianRp: number
  topBahan: WasteItemTelemetri[]
  topOutlet: WasteOutletTelemetri[]
  laporanHariIniCount: number
  estKerugianHariIniRp?: number
  laporanKemarinCount?: number
  estKerugianKemarinRp?: number
}

export interface VoidOrderTelemetri {
  totalVoidHariIni: number
  totalNilaiVoidHariIni: number
  daftarOutletVoidHariIni: Array<{
    outlet: string
    nilai: number
    waktu: string
  }>
  totalVoidKemarin?: number
  totalNilaiVoidKemarin?: number
  daftarOutletVoidKemarin?: Array<{
    outlet: string
    nilai: number
    waktu: string
  }>
}

export interface StatusBukaTelemetri {
  totalBuka: number
  totalBelumBuka: number
  daftarBuka: Array<{
    outlet: string
    jamBuka: string
    status: string
  }>
  daftarBelumBuka: string[]
  shiftKemarinClosedCount?: number
  shiftKemarinTotalCount?: number
}

export interface HrdHarianTelemetri {
  tanggalIso: string
  kehadiranTotal: number
  kehadiranTepatWaktu: number
  kehadiranTelat: number
  persenOnTime: number
  stafTelat: StafTelatTelemetri[]
  stafCutiIzin: StafCutiTelemetri[]
}

export interface RingkasanHari {
  tanggalLabel: string
  tglIso: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
  topMenu?: Array<{ nama: string; qty: number; omzet: number }>
}

export interface FinanceItemPengeluaran {
  id: string
  nominal: number
  deskripsi: string
  kategori: string
  outlet: string
  tipe: 'petty_cash' | 'operasional'
  tanggal: string
}

export interface FinancePoUtang {
  nomorPo: string
  supplier: string
  nilaiTerima: number
  jatuhTempo: string | null
  statusBayar: string
  hariLewat: number | null
}

export interface FinanceSetoran {
  id: string
  nominal: number
  outlet: string
  tanggalJual: string
  kategori: string
  status: string
  waktu: string
}

export interface FinanceSelisihKasir {
  id: string
  outlet: string
  kasir: string
  selisih: number
  seharusnya: number
  fisik: number
  tanggal: string
}

export interface FinanceTelemetri {
  pengeluaranHariIni: {
    totalNominal: number
    jumlahTransaksi: number
    topPengeluaran: FinanceItemPengeluaran[]
  }
  pengeluaranKemarin?: {
    totalNominal: number
    jumlahTransaksi: number
    topPengeluaran: FinanceItemPengeluaran[]
  }
  pengeluaranBulanIni: {
    totalNominal: number
    topPengeluaran: FinanceItemPengeluaran[]
  }
  utangPo: {
    totalUtang: number
    jumlahPo: number
    totalLewatJatuhTempo: number
    topSupplier: Array<{ supplier: string; total: number; jumlahPo: number; jatuhTempoTerdekat: string | null }>
    daftarPo: FinancePoUtang[]
  }
  setoranKas: {
    daftarSetoranTerbaru: FinanceSetoran[]
    inputHariIni?: {
      totalNominal: number
      jumlahTransaksi: number
      rekapPerTanggalJual: Array<{ tanggalJual: string; totalNominal: number; jumlah: number }>
    }
    tutupShiftKemarin?: {
      totalFisikKas: number
      totalSetoranDirekap?: number
      jumlahOutletClosed: number
      sudahDirekap: number
      belumDirekap: number
      daftarBelumSetor?: string[]
    }
  }
  selisihKasir: {
    daftarSelisihTerbaru: FinanceSelisihKasir[]
    selisihKemarin?: FinanceSelisihKasir[]
    totalSelisihKemarinRp?: number
  }
}

export interface SaldoStokItemTelemetri {
  bahanId: string
  nama: string
  satuan: string
  totalStokJaringan: number
  stokGudangPusat: number
  outletKritisCount: number
  daftarOutlet: Array<{ outlet: string; qty: number; opnameTerakhir: string | null }>
}

export interface SuratJalanTelemetri {
  id: string
  outlet: string
  status: string
  tanggal: string
  totalItem: number
  adaSelisih: boolean
  rincianSelisih?: string[]
}

export interface DistribusiTelemetri {
  totalSuratJalanDikirim: number
  totalSuratJalanAdaSelisih: number
  daftarSuratJalanTerbaru: SuratJalanTelemetri[]
}

export interface ReviewTelemetri {
  totalUlasan: number
  ratingRataRata: number
  topCabangRating: Array<{ outlet: string; rating: number; totalUlasan: number }>
  ulasanNegatifTerbaru: Array<{ outlet: string; reviewer: string; rating: number; komentar: string; waktu: string }>
}

export interface TelemetriHariIni {
  tanggalWIB: string
  tanggalKemarinWIB?: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outlets: OutletTelemetri[]
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
  topMenu: Array<{ nama: string; qty: number; omzet: number }>
  topMenuKemarin?: Array<{ nama: string; qty: number; omzet: number }>
  kehadiranTotal: number
  kehadiranTepatWaktu: number
  kehadiranTelat: number
  persenOnTime: number
  totalOutletAktif: number
  bahanBaku: Array<{ nama: string; satuan: string }>
  stafCutiIzin: StafCutiTelemetri[]
  stafTelat: StafTelatTelemetri[]
  hrdKemarin?: HrdHarianTelemetri
  waste?: WasteTelemetri
  voidOrder?: VoidOrderTelemetri
  statusBuka?: StatusBukaTelemetri
  ringkasanHariIni?: RingkasanHari
  ringkasanKemarin?: RingkasanHari
  finance?: FinanceTelemetri
  review?: ReviewTelemetri
  saldoStok?: SaldoStokItemTelemetri[]
  distribusi?: DistribusiTelemetri
}

let cachedTelemetri: { data: TelemetriHariIni; timestamp: number } | null = null
let inFlightPromise: Promise<TelemetriHariIni | null> | null = null
const TELEMETRI_CACHE_TTL_MS = 30_000

export function resetTelemetriCache(): void {
  cachedTelemetri = null
  inFlightPromise = null
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

const DEFAULT_SUKAREVIEW_URL = 'https://ajvzmicqtwgrcknovubf.supabase.co'
const DEFAULT_SUKAREVIEW_KEY = 'sb_publishable_6WuTWf-ucDNha96WITsBwA_YLqfMNd4'

function getSukaReviewClient() {
  const url = process.env.SUKAREVIEW_SUPABASE_URL || DEFAULT_SUKAREVIEW_URL
  const key = process.env.SUKAREVIEW_SERVICE_ROLE_KEY || process.env.SUKAREVIEW_SUPABASE_ANON_KEY || DEFAULT_SUKAREVIEW_KEY
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function formatRupiah(angka: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka)
}

const TIPE_OUTLET_NON_PENJUALAN = new Set([
  'test',
  'marketplace',
  'office',
  'gudang',
  'warehouse',
  'kitchen',
  'system',
])

export function adalahOutletPenjualan(nama: string, tipe: string, kode = '', slug = ''): boolean {
  const t = (tipe || '').trim().toLowerCase()
  const k = (kode || '').trim().toLowerCase()
  const s = (slug || '').trim().toLowerCase()
  const n = (nama || '').trim().toLowerCase()
  if (TIPE_OUTLET_NON_PENJUALAN.has(t)) return false
  if (k === 'ss-backup' || s === 'ss-backup') return false
  if (/\b(tes|test|trial|demo)\b/i.test(n)) return false
  if (n.includes('gudang') || n.includes('kantor pusat') || n.includes('(hq)') || n.includes('ss backup')) return false
  return true
}

const FOOD_APP_CHANNELS = new Set(['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'])

function hitungRingkasan(
  ordersData: any[],
  baseOutlets: any[],
  tglLabel: string,
  tglIso: string
): RingkasanHari {
  const validOutletIds = new Set(baseOutlets.map((o: any) => o.id))
  const mapOmzet: Record<string, number> = {}
  const mapCount: Record<string, number> = {}
  let omzetTotal = 0
  let totalOrder = 0
  for (const o of ordersData) {
    const id = o.outlet_id
    if (validOutletIds.size > 0 && !validOutletIds.has(id)) continue

    // Acuan Tunggal Omzet Kotor (Gross Revenue):
    // Jika Food Apps, total_amount sudah harga menu utuh (Gross).
    // Jika non-Food Apps, omzet kotor = total_amount + discount_amount.
    const ch = (o.channel || '').toLowerCase()
    const src = (o.sales_source || '').toLowerCase()
    const isFoodApp = FOOD_APP_CHANNELS.has(ch) || FOOD_APP_CHANNELS.has(src)
    const baseAmt = Number(o.total_amount) || 0
    const disc = Number(o.discount_amount) || 0
    const grossAmt = isFoodApp ? baseAmt : (baseAmt + disc)

    mapOmzet[id] = (mapOmzet[id] || 0) + grossAmt
    mapCount[id] = (mapCount[id] || 0) + 1
    omzetTotal += grossAmt
    totalOrder += 1
  }
  const allOutlets: OutletTelemetri[] = baseOutlets.map((o: any) => ({
    id: o.id,
    nama: o.name,
    type: o.type || 'internal',
    omzet: mapOmzet[o.id] || 0,
    orderCount: mapCount[o.id] || 0,
  })).sort((a, b) => b.omzet - a.omzet)

  const outletsAktifTransaksi = allOutlets.filter((o) => o.orderCount > 0)
  const outletsNolTransaksi = allOutlets.filter((o) => o.orderCount === 0)
  const aov = totalOrder > 0 ? Math.round(omzetTotal / totalOrder) : 0

  return {
    tanggalLabel: tglLabel,
    tglIso,
    omzetTotal,
    totalOrder,
    aov,
    outletsAktifTransaksi,
    outletsNolTransaksi,
  }
}

async function fetchAllRows(
  sb: any,
  table: string,
  buildFn: (q: any) => any,
  pageSize = 1000,
  maxRows = 10000
): Promise<any[]> {
  const all: any[] = []
  let page = 0
  while (all.length < maxRows) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const base = sb.from(table)
    const { data, error } = await buildFn(base).range(from, to)
    if (error) {
      console.error(`[telemetriNyata:fetchAllRows] Error fetching ${table} (page ${page}):`, error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return all
}

export async function ambilTelemetriNyata(forceRefresh = false): Promise<TelemetriHariIni | null> {
  const now = Date.now()
  if (!forceRefresh && cachedTelemetri && now - cachedTelemetri.timestamp < TELEMETRI_CACHE_TTL_MS) {
    return cachedTelemetri.data
  }
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise
  }
  inFlightPromise = muatTelemetriNyataInternal()
    .then((data) => {
      if (data) {
        cachedTelemetri = { data, timestamp: Date.now() }
      }
      return data
    })
    .finally(() => {
      inFlightPromise = null
    })
  return inFlightPromise
}

async function muatTelemetriNyataInternal(): Promise<TelemetriHariIni | null> {
  try {
    const sb = getSupabaseAdmin()
    // Konversi langsung UTC epoch -> WIB (UTC+7) agar .toISOString() menghasilkan tanggal WIB akurat di semua timezone server
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const tglStr = wib.toISOString().slice(0, 10)
    const wibBesok = new Date(wib.getTime() + 24 * 60 * 60 * 1000)
    const tglBesokStr = wibBesok.toISOString().slice(0, 10)
    const wibKemarin = new Date(wib.getTime() - 24 * 60 * 60 * 1000)
    const tglKemarinStr = wibKemarin.toISOString().slice(0, 10)

    const startKemarin = `${tglKemarinStr}T00:00:00+07:00`
    const endKemarin = `${tglStr}T00:00:00+07:00`
    const startToday = `${tglStr}T00:00:00+07:00`
    const endToday = `${tglBesokStr}T00:00:00+07:00`
    const wib30 = new Date(wib.getTime() - 30 * 24 * 60 * 60 * 1000)
    const tgl30Str = wib30.toISOString().slice(0, 10)
    const start30 = `${tgl30Str}T00:00:00+07:00`

    const [
      ordersHariIni,
      ordersKemarin,
      items,
      itemsKemarin,
      resAtt,
      resAttKemarin,
      resOutlets,
      resBahan,
      resLeave,
      resLeaveKemarin,
      resLate,
      resLateKemarin,
      resWaste,
      resVoid,
      resVoidKemarin,
      resShifts,
      resPrices,
      resPettyHariIni,
      resExpHariIni,
      resPettyKemarin,
      resExpKemarin,
      resExpBulanIni,
      resPo,
      resSetoran,
      resSelisih,
      resReviews,
      resShiftsKemarin,
      resReviewOutlets,
      resSaldoStok,
      resSuratJalan,
    ] = await Promise.all([
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, discount_amount, channel, sales_source, status, outlet_id, outlets(name)')
          .gte('created_at', startToday)
          .lt('created_at', endToday)
          .in('status', ['completed', 'settled'])
          .order('id', { ascending: true })
      ).catch((err) => {
        console.error('[telemetriNyata] gagal fetch orders hari ini:', err)
        return []
      }),
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, discount_amount, channel, sales_source, status, outlet_id, outlets(name)')
          .gte('created_at', startKemarin)
          .lt('created_at', endKemarin)
          .in('status', ['completed', 'settled'])
          .order('id', { ascending: true })
      ).catch((err) => {
        console.error('[telemetriNyata] gagal fetch orders kemarin:', err)
        return []
      }),
      fetchAllRows(sb, 'order_items', (q) =>
        q
          .select('id, quantity, menu_item_name, subtotal, orders!inner(created_at, status)')
          .gte('orders.created_at', startToday)
          .lt('orders.created_at', endToday)
          .in('orders.status', ['completed', 'settled'])
          .order('id', { ascending: true })
      ).catch((err) => {
        console.error('[telemetriNyata] gagal fetch order_items hari ini:', err)
        return []
      }),
      fetchAllRows(sb, 'order_items', (q) =>
        q
          .select('id, quantity, menu_item_name, subtotal, orders!inner(created_at, status)')
          .gte('orders.created_at', startKemarin)
          .lt('orders.created_at', endKemarin)
          .in('orders.status', ['completed', 'settled'])
          .order('id', { ascending: true })
      ).catch((err) => {
        console.error('[telemetriNyata] gagal fetch order_items kemarin:', err)
        return []
      }),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code, slug)')
        .eq('type', 'in')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .limit(2000)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error attendance hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject attendance hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code, slug)')
        .eq('type', 'in')
        .gte('created_at', startKemarin)
        .lt('created_at', endKemarin)
        .limit(2000)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error attendance kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject attendance kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('outlets')
        .select('id, name, type, code, slug, is_active')
        .eq('is_active', true)
        .order('name')
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error outlets:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject outlets:', err)
          return { data: [] }
        }),
      sb
        .from('bahan_baku')
        .select('id, nama, satuan')
        .eq('is_active', true)
        .limit(30)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error bahan_baku:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject bahan_baku:', err)
          return { data: [] }
        }),
      sb
        .from('leave_requests')
        .select('id, leave_type, status, reason, outlet_staff:staff_id(name, role, outlet_id)')
        .lte('start_date', tglStr)
        .gte('end_date', tglStr)
        .in('status', ['approved', 'pending'])
        .limit(50)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error leave hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject leave hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('leave_requests')
        .select('id, leave_type, status, reason, outlet_staff:staff_id(name, role, outlet_id)')
        .lte('start_date', tglKemarinStr)
        .gte('end_date', tglKemarinStr)
        .in('status', ['approved', 'pending'])
        .limit(50)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error leave kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject leave kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code, slug)')
        .eq('type', 'in')
        .neq('status', 'telat_toleransi')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .gt('telat_menit', 0)
        .order('telat_menit', { ascending: false })
        .limit(30)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error late attendance hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject late attendance hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code, slug)')
        .eq('type', 'in')
        .neq('status', 'telat_toleransi')
        .gte('created_at', startKemarin)
        .lt('created_at', endKemarin)
        .gt('telat_menit', 0)
        .order('telat_menit', { ascending: false })
        .limit(30)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error late attendance kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject late attendance kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('stok_waste_reports')
        .select('id, qty, reason, status, created_at, outlet_id, bahan_baku_id, outlets(name), bahan_baku(nama, satuan)')
        .gte('created_at', start30)
        .order('created_at', { ascending: false })
        .limit(600)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error waste:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject waste:', err)
          return { data: [] }
        }),
      sb
        .from('orders')
        .select('id, total_amount, created_at, outlet_id, outlets(name)')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error void hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject void hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('orders')
        .select('id, total_amount, created_at, outlet_id, outlets(name)')
        .gte('created_at', startKemarin)
        .lt('created_at', endKemarin)
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error void kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject void kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('shifts')
        .select('id, outlet_id, status, start_time, end_time, variance, petty_cash_variance, outlets(name)')
        .or(`and(start_time.gte.${startToday},start_time.lt.${endToday}),status.eq.open`)
        .order('start_time', { ascending: true })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error shifts:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject shifts:', err)
          return { data: [] }
        }),
      sb
        .from('bahan_baku_harga')
        .select('bahan_baku_id, harga_beli, harga_updated_at')
        .order('harga_updated_at', { ascending: false })
        .limit(200)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error bahan_baku_harga:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject bahan_baku_harga:', err)
          return { data: [] }
        }),
      sb
        .from('petty_cash_expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglStr)
        .is('deleted_at', null)
        .order('amount', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error petty cash hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject petty cash hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglStr)
        .order('amount', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error expenses hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject expenses hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('petty_cash_expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglKemarinStr)
        .is('deleted_at', null)
        .order('amount', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error petty cash kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject petty cash kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglKemarinStr)
        .order('amount', { ascending: false })
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error expenses kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject expenses kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .gte('expense_date', `${tglStr.slice(0, 7)}-01`)
        .order('amount', { ascending: false })
        .limit(10)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error expenses bulan ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject expenses bulan ini:', err)
          return { data: [] }
        }),
      sb
        .rpc('get_purchase_orders', { p_from: `${tglStr.slice(0, 4)}-01-01`, p_to: tglStr, p_status: null })
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error get_purchase_orders:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject get_purchase_orders:', err)
          return { data: [] }
        }),
      sb
        .from('cash_transaction')
        .select('id, outlet_id, amount, category, occurred_at, sales_date, status, outlets(name)')
        .eq('source_type', 'cash_deposit')
        .in('status', ['reconciled', 'paid', 'approved', 'pending_approval'])
        .order('occurred_at', { ascending: false })
        .limit(300)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error cash_transaction:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject cash_transaction:', err)
          return { data: [] }
        }),
      sb
        .from('shifts')
        .select('id, outlet_id, status, start_time, end_time, variance, expected_ending_cash, actual_ending_cash, staff:outlet_staff!shifts_staff_id_fkey(name), outlets(name)')
        .eq('status', 'closed')
        .neq('variance', 0)
        .order('start_time', { ascending: false })
        .limit(10)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error shifts variance:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject shifts variance:', err)
          return { data: [] }
        }),
      getSukaReviewClient()
        .from('reviews')
        .select('id, rating, comment, reviewer_name, google_created_at, sentiment, urgency, outlets(name)')
        .order('google_created_at', { ascending: false })
        .limit(40)
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn SukaReview reviews:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject SukaReview reviews:', err)
          return { data: [] }
        }),
      sb
        .from('shifts')
        .select('id, outlet_id, status, start_time, end_time, actual_ending_cash, expected_ending_cash, variance, staff:outlet_staff!shifts_staff_id_fkey(name), outlets(name)')
        .gte('start_time', startKemarin)
        .lt('start_time', endKemarin)
        .eq('status', 'closed')
        .limit(100)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error shifts kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject shifts kemarin:', err)
          return { data: [] }
        }),
      getSukaReviewClient()
        .from('outlets')
        .select('id, name, slug, current_rating, total_reviews, is_active')
        .eq('is_active', true)
        .order('name')
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn SukaReview outlets:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject SukaReview outlets:', err)
          return { data: [] }
        }),
      sb
        .from('monitoring_view_spv')
        .select('outlet_id, bahan_baku_id, current_qty, last_opname_date, saldo_is_gram, outlets(name), bahan_baku(nama, satuan)')
        .limit(500)
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn monitoring_view_spv:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject monitoring_view_spv:', err)
          return { data: [] }
        }),
      sb
        .from('surat_jalan')
        .select(`
          id,
          outlet_id,
          status,
          created_at,
          outlets(name),
          surat_jalan_item(
            id,
            qty_dikirim,
            qty_terima,
            kondisi,
            selisih,
            bahan_baku(nama, satuan)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(15)
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn surat_jalan:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject surat_jalan:', err)
          return { data: [] }
        }),
    ])

    const rawOutlets = (resOutlets.data || []).filter((o: any) =>
      adalahOutletPenjualan(o.name, o.type, o.code, o.slug)
    )
    const validOutletIds = new Set(rawOutlets.map((o: any) => o.id))

    const isOutletCabang = (a: any) => {
      if (a.outlet_id && validOutletIds.has(a.outlet_id)) return true
      const outName = a.outlets?.name || ''
      const outType = a.outlets?.type || ''
      const outCode = a.outlets?.code || ''
      const outSlug = a.outlets?.slug || ''
      return adalahOutletPenjualan(outName, outType, outCode, outSlug)
    }

    const ROLE_BUKAN_KRU_OUTLET = new Set([
      'staff_pusat',
      'admin_hr',
      'admin_finance',
      'purchasing',
      'developer',
      'admin',
      'owner',
      'mitra',
      'kiosk',
    ])

    const ringkasanHariIni = hitungRingkasan(ordersHariIni, rawOutlets, `Hari Ini (${tglStr})`, tglStr)
    const ringkasanKemarin = hitungRingkasan(ordersKemarin, rawOutlets, `Kemarin (${tglKemarinStr})`, tglKemarinStr)

    // Top Menu Hari Ini
    const perMenu: Record<string, { qty: number; omzet: number }> = {}
    for (const it of items as any[]) {
      const nama = it.menu_item_name || 'Menu Lain'
      if (!perMenu[nama]) perMenu[nama] = { qty: 0, omzet: 0 }
      perMenu[nama].qty += Number(it.quantity) || 1
      perMenu[nama].omzet += Number(it.subtotal) || 0
    }
    const sortedMenu = Object.entries(perMenu)
      .map(([nama, val]) => ({ nama, ...val }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
    ringkasanHariIni.topMenu = sortedMenu

    // Top Menu Kemarin (H-1)
    const perMenuKemarin: Record<string, { qty: number; omzet: number }> = {}
    for (const it of itemsKemarin as any[]) {
      const nama = it.menu_item_name || 'Menu Lain'
      if (!perMenuKemarin[nama]) perMenuKemarin[nama] = { qty: 0, omzet: 0 }
      perMenuKemarin[nama].qty += Number(it.quantity) || 1
      perMenuKemarin[nama].omzet += Number(it.subtotal) || 0
    }
    const sortedMenuKemarin = Object.entries(perMenuKemarin)
      .map(([nama, val]) => ({ nama, ...val }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8)
    ringkasanKemarin.topMenu = sortedMenuKemarin

    // Kehadiran / HRD Kru Outlet Hari Ini
    const att = (resAtt.data || []).filter(isOutletCabang)
    const kehadiranTotal = att.length
    const kehadiranTelat = att.filter(
      (a: any) =>
        a.status !== 'telat_toleransi' &&
        (a.status === 'telat' || a.status === 'terlambat' || Number(a.telat_menit) > 0)
    ).length
    const kehadiranTepatWaktu = kehadiranTotal - kehadiranTelat
    const persenOnTime = kehadiranTotal > 0 ? Math.round((kehadiranTepatWaktu / kehadiranTotal) * 100) : 100

    // Kehadiran / HRD Kru Outlet Kemarin (H-1)
    const attKemarin = (resAttKemarin?.data || []).filter(isOutletCabang)
    const kehadiranTotalKemarin = attKemarin.length
    const kehadiranTelatKemarin = attKemarin.filter(
      (a: any) =>
        a.status !== 'telat_toleransi' &&
        (a.status === 'telat' || a.status === 'terlambat' || Number(a.telat_menit) > 0)
    ).length
    const kehadiranTepatWaktuKemarin = kehadiranTotalKemarin - kehadiranTelatKemarin
    const persenOnTimeKemarin =
      kehadiranTotalKemarin > 0 ? Math.round((kehadiranTepatWaktuKemarin / kehadiranTotalKemarin) * 100) : 100

    const totalOutletAktif = rawOutlets.length
    const bahanBaku = (resBahan.data || []).map((b: any) => ({ nama: b.nama, satuan: b.satuan }))

    const filterDanMapLeave = (rows: any[]): StafCutiTelemetri[] =>
      rows
        .filter((l: any) => {
          const staff = l.outlet_staff
          if (!staff) return false
          const role = (staff.role || '').toLowerCase()
          if (ROLE_BUKAN_KRU_OUTLET.has(role)) return false
          if (staff.outlet_id && !validOutletIds.has(staff.outlet_id)) return false
          return true
        })
        .map((l: any) => ({
          nama: l.outlet_staff?.name || 'Kru',
          role: l.outlet_staff?.role || 'Staff',
          jenis: l.leave_type || 'Cuti',
          status: l.status || 'pending',
          alasan: l.reason || '-',
        }))

    const stafCutiIzin = filterDanMapLeave(resLeave.data || [])
    const stafCutiIzinKemarin = filterDanMapLeave(resLeaveKemarin?.data || [])

    // Staf Telat Kru Outlet (Hari Ini & Kemarin)
    const lateFiltered = (resLate.data || []).filter(isOutletCabang)
    const lateKemarinFiltered = (resLateKemarin?.data || []).filter(isOutletCabang)
    const allLateStaffIds = Array.from(
      new Set([
        ...lateFiltered.map((a: any) => a.outlet_staff_id),
        ...lateKemarinFiltered.map((a: any) => a.outlet_staff_id),
      ].filter(Boolean))
    )
    const { data: staffList } = allLateStaffIds.length > 0
      ? await sb.from('outlet_staff').select('id, name, role').in('id', allLateStaffIds)
      : { data: [] }
    const staffMap: Record<string, { name: string; role: string }> = {}
    for (const s of (staffList || []) as any[]) {
      staffMap[s.id] = { name: s.name, role: s.role }
    }

    const mapLateRows = (rows: any[]): StafTelatTelemetri[] =>
      rows
        .filter((a: any) => {
          const role = (staffMap[a.outlet_staff_id]?.role || '').toLowerCase()
          return !ROLE_BUKAN_KRU_OUTLET.has(role)
        })
        .slice(0, 15)
        .map((a: any) => ({
          nama: staffMap[a.outlet_staff_id]?.name || 'Kru',
          outlet: a.outlets?.name || 'Cabang',
          telatMenit: Number(a.telat_menit) || 0,
        }))

    const stafTelat = mapLateRows(lateFiltered)
    const stafTelatKemarin = mapLateRows(lateKemarinFiltered)

    const hrdKemarin: HrdHarianTelemetri = {
      tanggalIso: tglKemarinStr,
      kehadiranTotal: kehadiranTotalKemarin,
      kehadiranTepatWaktu: kehadiranTepatWaktuKemarin,
      kehadiranTelat: kehadiranTelatKemarin,
      persenOnTime: persenOnTimeKemarin,
      stafTelat: stafTelatKemarin,
      stafCutiIzin: stafCutiIzinKemarin,
    }

    // ─────────────────────────────────────────────────────────── Waste & Reject Bahan Baku
    const priceMap: Record<string, number> = {}
    for (const p of (resPrices?.data || []) as any[]) {
      if (!priceMap[p.bahan_baku_id]) {
        priceMap[p.bahan_baku_id] = Number(p.harga_beli) || 0
      }
    }

    const wasteRows = (resWaste?.data || []) as any[]
    let totalEstKerugianRp = 0
    let laporanHariIniCount = 0
    let estKerugianHariIniRp = 0
    let laporanKemarinCount = 0
    let estKerugianKemarinRp = 0
    const bahanMap: Record<string, { nama: string; satuan: string; totalQty: number; frekuensi: number; reasons: Record<string, number>; estKerugianRp: number }> = {}
    const outletWasteMap: Record<string, { nama: string; frekuensi: number; totalQty: number }> = {}

    for (const r of wasteRows) {
      const bNama = r.bahan_baku?.nama || 'Bahan Baku'
      const sat = r.bahan_baku?.satuan || 'unit'
      const qty = Number(r.qty) || 0
      const hBeli = priceMap[r.bahan_baku_id] || 0
      const estLoss = Math.round(qty * hBeli)
      totalEstKerugianRp += estLoss

      if (r.created_at) {
        const wibWasteDate = new Date(Date.parse(r.created_at) + 7 * 3600000).toISOString().slice(0, 10)
        if (wibWasteDate === tglStr || r.created_at.startsWith(tglStr)) {
          laporanHariIniCount++
          estKerugianHariIniRp += estLoss
        } else if (wibWasteDate === tglKemarinStr || r.created_at.startsWith(tglKemarinStr)) {
          laporanKemarinCount++
          estKerugianKemarinRp += estLoss
        }
      }

      if (!bahanMap[bNama]) {
        bahanMap[bNama] = { nama: bNama, satuan: sat, totalQty: 0, frekuensi: 0, reasons: {}, estKerugianRp: 0 }
      }
      bahanMap[bNama].totalQty += qty
      bahanMap[bNama].frekuensi += 1
      bahanMap[bNama].estKerugianRp += estLoss
      const reas = (r.reason || 'Lainnya').trim()
      bahanMap[bNama].reasons[reas] = (bahanMap[bNama].reasons[reas] || 0) + 1

      const outNama = r.outlets?.name || 'Cabang'
      if (!outletWasteMap[outNama]) {
        outletWasteMap[outNama] = { nama: outNama, frekuensi: 0, totalQty: 0 }
      }
      outletWasteMap[outNama].frekuensi += 1
      outletWasteMap[outNama].totalQty += qty
    }

    const topBahanWaste = Object.values(bahanMap)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 5)
      .map(b => {
        const topReason = Object.entries(b.reasons).sort((x, y) => y[1] - x[1])[0]?.[0] || '-'
        return {
          nama: b.nama,
          satuan: b.satuan,
          totalQty: Math.round(b.totalQty * 100) / 100,
          frekuensi: b.frekuensi,
          alasanDominan: topReason,
          estKerugianRp: b.estKerugianRp,
        }
      })

    const topOutletWaste = Object.values(outletWasteMap)
      .sort((a, b) => b.frekuensi - a.frekuensi)
      .slice(0, 5)
      .map(o => ({
        nama: o.nama,
        frekuensi: o.frekuensi,
        totalQty: Math.round(o.totalQty * 10) / 10,
      }))

    const waste: WasteTelemetri = {
      totalLaporan30Hari: wasteRows.length,
      totalEstKerugianRp,
      topBahan: topBahanWaste,
      topOutlet: topOutletWaste,
      laporanHariIniCount,
      estKerugianHariIniRp,
      laporanKemarinCount,
      estKerugianKemarinRp,
    }

    // ─────────────────────────────────────────────────────────── Void & Pembatalan Transaksi POS (Hari Ini & Kemarin)
    const mapVoidRows = (rows: any[]) => {
      let totalNilai = 0
      const daftar = rows.map((v) => {
        const amt = Number(v.total_amount) || 0
        totalNilai += amt
        const waktuWib = v.created_at
          ? new Date(v.created_at).toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-'
        return {
          outlet: v.outlets?.name || 'Cabang',
          nilai: amt,
          waktu: waktuWib,
        }
      })
      return { totalVoid: rows.length, totalNilai, daftar }
    }

    const voidHariIniObj = mapVoidRows((resVoid?.data || []) as any[])
    const voidKemarinObj = mapVoidRows((resVoidKemarin?.data || []) as any[])

    const voidOrder: VoidOrderTelemetri = {
      totalVoidHariIni: voidHariIniObj.totalVoid,
      totalNilaiVoidHariIni: voidHariIniObj.totalNilai,
      daftarOutletVoidHariIni: voidHariIniObj.daftar,
      totalVoidKemarin: voidKemarinObj.totalVoid,
      totalNilaiVoidKemarin: voidKemarinObj.totalNilai,
      daftarOutletVoidKemarin: voidKemarinObj.daftar,
    }

    // ─────────────────────────────────────────────────────────── Status Buka Outlet & Jam Shift
    const shiftRows = (resShifts?.data || []) as any[]
    const openedMap = new Map<string, { outlet: string; jamBuka: string; status: string }>()
    for (const s of shiftRows) {
      if (s.outlet_id && !openedMap.has(s.outlet_id)) {
        const startWib = s.start_time
          ? new Date(s.start_time).toLocaleTimeString('id-ID', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-'
        openedMap.set(s.outlet_id, {
          outlet: s.outlets?.name || 'Cabang',
          jamBuka: startWib,
          status: s.status || 'open',
        })
      }
    }

    const daftarBuka = Array.from(openedMap.values())
    const daftarBelumBuka = rawOutlets
      .filter((o: any) => !openedMap.has(o.id))
      .map((o: any) => o.name)

    const rawShiftsKemarin = (resShiftsKemarin?.data || []) as any[]
    const uniqueOutletsShiftKemarin = new Set(rawShiftsKemarin.map((s: any) => s.outlet_id).filter(Boolean))

    const statusBuka: StatusBukaTelemetri = {
      totalBuka: daftarBuka.length,
      totalBelumBuka: daftarBelumBuka.length,
      daftarBuka,
      daftarBelumBuka,
      shiftKemarinClosedCount: uniqueOutletsShiftKemarin.size || rawShiftsKemarin.length,
      shiftKemarinTotalCount: rawOutlets.length,
    }

    // ─────────────────────────────────────────────────────────── Telemetri Finance (Hari Ini & Kemarin H-1)
    const rawPetty = (resPettyHariIni?.data || []) as any[]
    const rawExp = (resExpHariIni?.data || []) as any[]
    const rawPettyKemarin = (resPettyKemarin?.data || []) as any[]
    const rawExpKemarin = (resExpKemarin?.data || []) as any[]
    const rawExpBulan = (resExpBulanIni?.data || []) as any[]
    const rawPo = (resPo?.data || []) as any[]
    const rawSetoran = (resSetoran?.data || []) as any[]
    const rawSelisih = (resSelisih?.data || []) as any[]

    const gabungPengeluaranHarian = (pettyRows: any[], expRows: any[], defaultTgl: string): FinanceItemPengeluaran[] =>
      [
        ...pettyRows.map((r: any) => ({
          id: r.id,
          nominal: Number(r.amount) || 0,
          deskripsi: r.description || 'Pengeluaran kas kecil',
          kategori: r.category || 'petty_cash',
          outlet: r.outlets?.name || 'Cabang',
          tipe: 'petty_cash' as const,
          tanggal: r.expense_date || defaultTgl,
        })),
        ...expRows.map((r: any) => ({
          id: r.id,
          nominal: Number(r.amount) || 0,
          deskripsi: r.description || 'Operasional outlet',
          kategori: r.category || 'operasional',
          outlet: r.outlets?.name || 'Pusat',
          tipe: 'operasional' as const,
          tanggal: r.expense_date || defaultTgl,
        })),
      ].sort((a, b) => b.nominal - a.nominal)

    const itemsHariIni = gabungPengeluaranHarian(rawPetty, rawExp, tglStr)
    const totalNominalHariIni = itemsHariIni.reduce((sum, item) => sum + item.nominal, 0)

    const itemsKemarinPengeluaran = gabungPengeluaranHarian(rawPettyKemarin, rawExpKemarin, tglKemarinStr)
    const totalNominalKemarin = itemsKemarinPengeluaran.reduce((sum, item) => sum + item.nominal, 0)

    const topExpBulan: FinanceItemPengeluaran[] = rawExpBulan.map((r: any) => ({
      id: r.id,
      nominal: Number(r.amount) || 0,
      deskripsi: r.description || '-',
      kategori: r.category || 'beban_operasional',
      outlet: r.outlets?.name || 'Pusat',
      tipe: 'operasional' as const,
      tanggal: r.expense_date || tglStr,
    }))

    // PO Utang
    const poBelumLunas = rawPo.filter((p: any) => p.payment_status !== 'paid')
    const poDiterima = poBelumLunas.filter((p: any) =>
      ['sebagian_diterima', 'diterima_lengkap'].includes(p.status)
    )
    const totalUtangPo = poDiterima.reduce((s: number, p: any) => s + (Number(p.total_nilai_terima) || 0), 0)

    const supplierMap = new Map<string, { supplier: string; total: number; jumlahPo: number; jatuhTempoTerdekat: string | null }>()
    let totalLewatJatuhTempo = 0
    const daftarPoUtang: FinancePoUtang[] = poDiterima.map((p: any) => {
      const nilai = Number(p.total_nilai_terima) || 0
      const jt = p.jatuh_tempo ? String(p.jatuh_tempo).slice(0, 10) : null
      let hariLewat: number | null = null
      if (jt) {
        const diffMs = Date.parse(`${tglStr}T00:00:00Z`) - Date.parse(`${jt}T00:00:00Z`)
        hariLewat = Math.round(diffMs / (86_400_000))
        if (hariLewat > 0) {
          totalLewatJatuhTempo += nilai
        }
      }

      const sNama = p.supplier_nama || 'Supplier Umum'
      const existing = supplierMap.get(sNama) ?? {
        supplier: sNama,
        total: 0,
        jumlahPo: 0,
        jatuhTempoTerdekat: null,
      }
      existing.total += nilai
      existing.jumlahPo += 1
      if (jt && (!existing.jatuhTempoTerdekat || jt < existing.jatuhTempoTerdekat)) {
        existing.jatuhTempoTerdekat = jt
      }
      supplierMap.set(sNama, existing)

      return {
        nomorPo: p.nomor_po || '-',
        supplier: sNama,
        nilaiTerima: nilai,
        jatuhTempo: jt,
        statusBayar: p.payment_status || 'unpaid',
        hariLewat,
      }
    })

    const topSupplier = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total).slice(0, 5)

    const daftarSetoranTerbaru: FinanceSetoran[] = rawSetoran.map((s: any) => ({
      id: s.id,
      nominal: Number(s.amount) || 0,
      outlet: s.outlets?.name || 'Cabang',
      tanggalJual: s.sales_date ? String(s.sales_date).slice(0, 10) : '-',
      kategori: s.category || 'Setoran Bank',
      status: s.status || 'pending',
      waktu: s.occurred_at || '',
    }))

    const daftarSelisihTerbaru: FinanceSelisihKasir[] = rawSelisih.map((s: any) => ({
      id: s.id,
      outlet: s.outlets?.name || 'Cabang',
      kasir: s.staff?.name || '-',
      selisih: Number(s.variance) || 0,
      seharusnya: Number(s.expected_ending_cash) || 0,
      fisik: Number(s.actual_ending_cash) || 0,
      tanggal: s.start_time || '',
    }))

    const selisihKemarin: FinanceSelisihKasir[] = rawShiftsKemarin
      .filter((s: any) => Number(s.variance) !== 0)
      .map((s: any) => ({
        id: s.id,
        outlet: s.outlets?.name || 'Cabang',
        kasir: s.staff?.name || '-',
        selisih: Number(s.variance) || 0,
        seharusnya: Number(s.expected_ending_cash) || 0,
        fisik: Number(s.actual_ending_cash) || 0,
        tanggal: s.start_time || tglKemarinStr,
      }))
    const totalSelisihKemarinRp = selisihKemarin.reduce((acc, s) => acc + s.selisih, 0)

    const setoranHariIniInput = rawSetoran.filter((s: any) => {
      if (!s.occurred_at) return false
      const wibDate = new Date(Date.parse(s.occurred_at) + 7 * 3600000).toISOString().slice(0, 10)
      return wibDate === tglStr
    })
    const totalSetoranInputHariIni = setoranHariIniInput.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0)

    const rekapMap = new Map<string, { totalNominal: number; jumlah: number }>()
    for (const s of setoranHariIniInput) {
      const tj = s.sales_date ? String(s.sales_date).slice(0, 10) : 'Tanpa Tgl'
      const ex = rekapMap.get(tj) || { totalNominal: 0, jumlah: 0 }
      ex.totalNominal += Number(s.amount) || 0
      ex.jumlah += 1
      rekapMap.set(tj, ex)
    }
    const rekapPerTanggalJual = Array.from(rekapMap.entries())
      .map(([tanggalJual, val]) => ({ tanggalJual, totalNominal: val.totalNominal, jumlah: val.jumlah }))
      .sort((a, b) => b.tanggalJual.localeCompare(a.tanggalJual))

    const totalFisikKasKemarin = rawShiftsKemarin.reduce((sum: number, sh: any) => sum + (Number(sh.actual_ending_cash) || 0), 0)
    const setoranUntukSalesKemarin = rawSetoran.filter((s: any) => String(s.sales_date).slice(0, 10) === tglKemarinStr)
    const totalSetoranDirekapKemarin = setoranUntukSalesKemarin.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0)
    const outletSetorKemarin = new Set(setoranUntukSalesKemarin.map((s: any) => s.outlet_id))
    let sudahDirekapKemarin = 0
    let belumDirekapKemarin = 0
    const daftarBelumSetorSet = new Set<string>()
    for (const sh of rawShiftsKemarin) {
      if (outletSetorKemarin.has(sh.outlet_id)) {
        sudahDirekapKemarin++
      } else {
        belumDirekapKemarin++
        if (sh.outlets?.name) daftarBelumSetorSet.add(sh.outlets.name)
      }
    }

    const finance: FinanceTelemetri = {
      pengeluaranHariIni: {
        totalNominal: totalNominalHariIni,
        jumlahTransaksi: itemsHariIni.length,
        topPengeluaran: itemsHariIni.slice(0, 10),
      },
      pengeluaranKemarin: {
        totalNominal: totalNominalKemarin,
        jumlahTransaksi: itemsKemarinPengeluaran.length,
        topPengeluaran: itemsKemarinPengeluaran.slice(0, 10),
      },
      pengeluaranBulanIni: {
        totalNominal: topExpBulan.reduce((sum, item) => sum + item.nominal, 0),
        topPengeluaran: topExpBulan,
      },
      utangPo: {
        totalUtang: totalUtangPo,
        jumlahPo: poDiterima.length,
        totalLewatJatuhTempo,
        topSupplier,
        daftarPo: daftarPoUtang.slice(0, 10),
      },
      setoranKas: {
        daftarSetoranTerbaru,
        inputHariIni: {
          totalNominal: totalSetoranInputHariIni,
          jumlahTransaksi: setoranHariIniInput.length,
          rekapPerTanggalJual,
        },
        tutupShiftKemarin: {
          totalFisikKas: totalFisikKasKemarin,
          totalSetoranDirekap: totalSetoranDirekapKemarin,
          jumlahOutletClosed: rawShiftsKemarin.length,
          sudahDirekap: sudahDirekapKemarin,
          belumDirekap: belumDirekapKemarin,
          daftarBelumSetor: Array.from(daftarBelumSetorSet),
        },
      },
      selisihKasir: {
        daftarSelisihTerbaru,
        selisihKemarin,
        totalSelisihKemarinRp,
      },
    }

    // ─────────────────────────────────────────────────────────── Saldo Stok Bahan Baku (monitoring_view_spv)
    const rawSaldoStok = (resSaldoStok?.data || []) as any[]
    const stokBahanMap = new Map<string, SaldoStokItemTelemetri>()

    for (const r of rawSaldoStok) {
      const bId = r.bahan_baku_id || 'unknown'
      const bNama = r.bahan_baku?.nama || 'Bahan Baku'
      const bSat = r.bahan_baku?.satuan || 'unit'
      const qty = Number(r.current_qty) || 0
      const outNama = r.outlets?.name || 'Cabang'
      const isPusat = /pusat|gudang|hq/i.test(outNama)

      if (!stokBahanMap.has(bId)) {
        stokBahanMap.set(bId, {
          bahanId: bId,
          nama: bNama,
          satuan: bSat,
          totalStokJaringan: 0,
          stokGudangPusat: 0,
          outletKritisCount: 0,
          daftarOutlet: [],
        })
      }
      const item = stokBahanMap.get(bId)!
      if (isPusat) {
        item.stokGudangPusat += qty
      } else {
        item.totalStokJaringan += qty
        if (qty <= 0) {
          item.outletKritisCount += 1
        }
      }
      item.daftarOutlet.push({
        outlet: outNama,
        qty,
        opnameTerakhir: r.last_opname_date || null,
      })
    }

    const saldoStok: SaldoStokItemTelemetri[] = Array.from(stokBahanMap.values())
      .sort((a, b) => b.outletKritisCount - a.outletKritisCount || b.totalStokJaringan - a.totalStokJaringan)

    // ─────────────────────────────────────────────────────────── Distribusi & Pengiriman Surat Jalan
    const rawSj = (resSuratJalan?.data || []) as any[]
    const daftarSuratJalanTerbaru: SuratJalanTelemetri[] = rawSj.map((sj: any) => {
      const items = sj.surat_jalan_item || []
      const rincianSelisih: string[] = []
      let adaSelisih = false
      for (const it of items) {
        const diff = Number(it.selisih) || 0
        if (diff !== 0 || (it.kondisi && it.kondisi !== 'baik')) {
          adaSelisih = true
          const bNama = it.bahan_baku?.nama || 'Item'
          const sat = it.bahan_baku?.satuan || ''
          rincianSelisih.push(
            `${bNama}: kirim ${it.qty_dikirim}, terima ${it.qty_terima} (${diff > 0 ? '+' : ''}${diff} ${sat}) - ${it.kondisi || 'selisih'}`
          )
        }
      }
      return {
        id: sj.id,
        outlet: sj.outlets?.name || 'Cabang',
        status: sj.status || 'draft',
        tanggal: sj.created_at ? String(sj.created_at).slice(0, 10) : '-',
        totalItem: items.length,
        adaSelisih,
        rincianSelisih: rincianSelisih.length > 0 ? rincianSelisih : undefined,
      }
    })

    const distribusi: DistribusiTelemetri = {
      totalSuratJalanDikirim: rawSj.length,
      totalSuratJalanAdaSelisih: daftarSuratJalanTerbaru.filter((s) => s.adaSelisih).length,
      daftarSuratJalanTerbaru,
    }

    // ─────────────────────────────────────────────────────────── Ulasan Pelanggan (SukaReview External Supabase)
    const reviewData = (resReviews?.data || []) as any[]
    const reviewOutletsData = (resReviewOutlets?.data || []) as any[]
    let reviewTelemetri: ReviewTelemetri | undefined = undefined
    if (reviewData.length > 0 || reviewOutletsData.length > 0) {
      const totalUlasan = reviewOutletsData.reduce((acc, o) => acc + (Number(o.total_reviews) || 0), 0) || reviewData.length
      const avg = reviewOutletsData.length > 0
        ? reviewOutletsData.reduce((acc, o) => acc + (Number(o.current_rating) || 0), 0) / reviewOutletsData.length
        : reviewData.reduce((acc: number, r: any) => acc + (Number(r.rating) || 0), 0) / (reviewData.length || 1)

      const topCabangRating = reviewOutletsData
        .map((o: any) => ({
          outlet: o.name || 'Cabang',
          rating: Number(o.current_rating) || 0,
          totalUlasan: Number(o.total_reviews) || 0,
        }))
        .sort((a, b) => b.rating - a.rating)

      const ulasanNegatifTerbaru = reviewData
        .filter((r: any) => (Number(r.rating) || 0) <= 2)
        .slice(0, 5)
        .map((r: any) => ({
          outlet: r.outlets?.name || 'Cabang',
          reviewer: r.reviewer_name || 'Pelanggan',
          rating: Number(r.rating) || 0,
          komentar: r.comment || '',
          waktu: r.google_created_at ? String(r.google_created_at).slice(0, 10) : '',
        }))

      reviewTelemetri = {
        totalUlasan,
        ratingRataRata: Math.round(avg * 10) / 10,
        topCabangRating,
        ulasanNegatifTerbaru,
      }
    }

    return {
      tanggalWIB: tglStr,
      tanggalKemarinWIB: tglKemarinStr,
      omzetTotal: ringkasanHariIni.omzetTotal,
      totalOrder: ringkasanHariIni.totalOrder,
      aov: ringkasanHariIni.aov,
      outlets: ringkasanHariIni.outletsAktifTransaksi.concat(ringkasanHariIni.outletsNolTransaksi),
      outletsAktifTransaksi: ringkasanHariIni.outletsAktifTransaksi,
      outletsNolTransaksi: ringkasanHariIni.outletsNolTransaksi,
      topMenu: sortedMenu,
      topMenuKemarin: sortedMenuKemarin,
      kehadiranTotal,
      kehadiranTepatWaktu,
      kehadiranTelat,
      persenOnTime,
      totalOutletAktif,
      bahanBaku,
      stafCutiIzin,
      stafTelat,
      hrdKemarin,
      waste,
      voidOrder,
      statusBuka,
      ringkasanHariIni,
      ringkasanKemarin,
      finance,
      review: reviewTelemetri,
      saldoStok,
      distribusi,
    }
  } catch (err) {
    console.error('[telemetriNyata] gagal ambil telemetri:', err)
    return null
  }
}
