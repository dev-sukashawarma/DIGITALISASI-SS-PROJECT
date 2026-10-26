import { createClient } from '@supabase/supabase-js'
import { formatTriUnitSaldoAdaptive, formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'

function formatQtyBahanAdaptif(
  qtyBesar: number,
  b?: {
    satuan?: string | null
    satuan_tengah?: string | null
    faktor_tengah?: number | null
    satuan_kecil?: string | null
    faktor_tampilan?: number | null
  } | null
): string {
  const satBesar = (b?.satuan || 'unit').trim()
  const satTengah = b?.satuan_tengah ? String(b.satuan_tengah).trim() : null
  const fTengah = Number(b?.faktor_tengah) || null
  const satKecil = b?.satuan_kecil ? String(b.satuan_kecil).trim() : null
  const fTampilan = Number(b?.faktor_tampilan) || null
  if (satKecil && fTampilan && fTampilan > 0) {
    return formatTriUnitSaldoFromGram(
      Math.round(qtyBesar * fTampilan * 100) / 100,
      satBesar,
      satTengah,
      fTengah,
      satKecil,
      fTampilan
    )
  }
  return formatTriUnitSaldoAdaptive(qtyBesar, false, satBesar, satTengah, fTengah, satKecil, fTampilan)
}

export interface RincianKanalOutlet {
  kanal: string
  omzetKotor: number
  omzetBersih: number
  potongan: number
  orderCount: number
}

export interface OutletTelemetri {
  id: string
  nama: string
  type: string
  omzet: number
  omzetBersih?: number
  potongan?: number
  totalPorsi?: number
  totalHpp?: number
  labaKotor?: number
  orderCount: number
  rincianKanal?: RincianKanalOutlet[]
  topMenuCabang?: Array<{ nama: string; qty: number; omzet: number }>
  menuTersepiCabang?: Array<{ nama: string; qty: number; omzet: number }>
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
  estKerugianRp?: number
}

export interface WasteLaporanItem {
  id: string
  outlet: string
  bahan: string
  qty: number
  satuan: string
  reason: string
  status: string
  estKerugianRp: number
  waktu?: string
}

export interface WasteOutletRekap {
  outlet: string
  totalLaporan: number
  totalQty: number
  estKerugianRp: number
  items: string[]
}

export interface WasteTelemetri {
  totalLaporan30Hari: number
  totalEstKerugianRp: number
  topBahan: WasteItemTelemetri[]
  topOutlet: WasteOutletTelemetri[]
  laporanHariIniCount: number
  estKerugianHariIniRp?: number
  rincianHariIni?: WasteLaporanItem[]
  rekapOutletHariIni?: WasteOutletRekap[]
  laporanKemarinCount?: number
  estKerugianKemarinRp?: number
  rincianKemarin?: WasteLaporanItem[]
  rekapOutletKemarin?: WasteOutletRekap[]
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
  omzetBersihTotal?: number
  potonganTotal?: number
  totalPorsi?: number
  totalHpp?: number
  labaKotorTotal?: number
  totalOrder: number
  aov: number
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
  topMenu?: Array<{ nama: string; qty: number; omzet: number }>
  menuTersepi?: Array<{ nama: string; qty: number; omzet: number }>
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

export interface FinanceRekapOutletPengeluaran {
  outlet: string
  totalNominal: number
  jumlahTransaksi: number
  rincian: string[]
}

export interface FinanceShiftCabangKemarin {
  outlet: string
  kasir: string
  fisik: number
  seharusnya: number
  selisih: number
  sudahDirekap: boolean
}

export interface FinanceTelemetri {
  pengeluaranHariIni: {
    totalNominal: number
    jumlahTransaksi: number
    topPengeluaran: FinanceItemPengeluaran[]
    rekapPerOutlet?: FinanceRekapOutletPengeluaran[]
  }
  pengeluaranKemarin?: {
    totalNominal: number
    jumlahTransaksi: number
    topPengeluaran: FinanceItemPengeluaran[]
    rekapPerOutlet?: FinanceRekapOutletPengeluaran[]
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
      rincianCabang?: FinanceShiftCabangKemarin[]
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
  ringkasanItem?: string
  adaSelisih: boolean
  rincianSelisih?: string[]
}

export interface DistribusiTelemetri {
  totalSuratJalanDikirim: number
  totalSuratJalanMenggantung?: number
  totalSuratJalanAdaSelisih: number
  daftarSuratJalanMenggantung?: SuratJalanTelemetri[]
  daftarSuratJalanTerbaru: SuratJalanTelemetri[]
}

export interface ReviewTelemetri {
  totalUlasan: number
  ratingRataRata: number
  topCabangRating: Array<{ outlet: string; rating: number; totalUlasan: number }>
  ulasanNegatifTerbaru: Array<{ outlet: string; reviewer: string; rating: number; komentar: string; waktu: string }>
}

export interface CeklistTemuanItem {
  outlet: string
  namaAm: string
  tanggal: string
  nilaiTerburuk: 'baik' | 'perhatian' | 'buruk'
  temuan: string[]
  perbaikan: string[]
  sudahDitinjauRm: boolean
}

export interface CeklistHarianTelemetri {
  totalOutletWajib: number
  totalSudahDicekHariIni: number
  totalSudahDicekKemarin: number
  totalPerluPerhatianKemarin: number
  totalBelumDitinjauRm: number
  daftarTemuanTerbaru: CeklistTemuanItem[]
  daftarKunjunganKemarin?: CeklistTemuanItem[]
  daftarBelumDicekKemarin: string[]
}

export interface KasbonItemTelemetri {
  id: string
  nama: string
  role: string
  outlet: string
  nominal: number
  sisa: number
  alasan: string
  status: string
  tanggal: string
}

export interface KasbonHrdTelemetri {
  totalPendingCount: number
  totalPendingNominal: number
  totalAktifCount: number
  totalSisaPiutang: number
  daftarPendingTerbaru: KasbonItemTelemetri[]
}

export interface TrenHarianTelemetri {
  tanggalH2Iso: string
  omzetH2: number
  orderH2: number
  opexH2: number
  wasteH2Rp: number
  deltaOmzetPersen: number | null
  deltaOrderPersen: number | null
  deltaOpexPersen: number | null
  deltaWastePersen: number | null
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
  ceklistHarian?: CeklistHarianTelemetri
  kasbonHrd?: KasbonHrdTelemetri
  trenHarian?: TrenHarianTelemetri
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

function identifikasiKanalOrder(chRaw: string, srcRaw: string): { label: string; isFoodApp: boolean; isTikTokGo: boolean } {
  const ch = (chRaw || '').toLowerCase().trim()
  const src = (srcRaw || '').toLowerCase().trim()
  if (
    ch === 'tiktok' ||
    ch === 'tiktokgo' ||
    ch === 'tiktok_go' ||
    src === 'tiktok' ||
    src === 'tiktokgo' ||
    src === 'tiktok_go' ||
    (ch.includes('tiktok') && !ch.includes('shop') && !ch.includes('seller')) ||
    (src.includes('tiktok') && !src.includes('shop') && !src.includes('seller'))
  ) {
    return { label: 'TikTok GO', isFoodApp: true, isTikTokGo: true }
  }
  if (ch.includes('gofood') || src.includes('gofood') || ch.includes('gojek') || src.includes('gojek')) {
    return { label: 'GoFood', isFoodApp: true, isTikTokGo: false }
  }
  if (ch.includes('grab') || src.includes('grab')) {
    return { label: 'GrabFood', isFoodApp: true, isTikTokGo: false }
  }
  if (
    ch === 'shopeefood' ||
    src === 'shopeefood' ||
    ch === 'shopee_food' ||
    src === 'shopee_food' ||
    (ch.includes('shopee') && !ch.includes('shopee_shop') && !ch.includes('seller')) ||
    (src.includes('shopee') && !src.includes('shopee_shop') && !src.includes('seller'))
  ) {
    return { label: 'ShopeeFood', isFoodApp: true, isTikTokGo: false }
  }
  if (FOOD_APP_CHANNELS.has(ch) || FOOD_APP_CHANNELS.has(src)) {
    return { label: 'Food Apps', isFoodApp: true, isTikTokGo: false }
  }
  if (ch === 'online' || src === 'online' || ch === 'website' || src === 'website') {
    return { label: 'Website Online', isFoodApp: false, isTikTokGo: false }
  }
  return { label: 'POS Kasir', isFoodApp: false, isTikTokGo: false }
}

function hitungRingkasan(
  ordersData: any[],
  baseOutlets: any[],
  tglLabel: string,
  tglIso: string
): RingkasanHari {
  const validOutletIds = new Set(baseOutlets.map((o: any) => o.id))
  const mapOmzet: Record<string, number> = {}
  const mapOmzetBersih: Record<string, number> = {}
  const mapPotongan: Record<string, number> = {}
  const mapCount: Record<string, number> = {}
  const mapFallbackNama: Record<string, string> = {}
  const mapKanal: Record<string, Record<string, RincianKanalOutlet>> = {}

  let omzetTotal = 0
  let omzetBersihTotal = 0
  let potonganTotal = 0
  let totalOrder = 0

  for (const o of ordersData) {
    const id = o.outlet_id
    if (!id) continue
    const fallbackName = o.outlets?.name || ''
    if (validOutletIds.size > 0 && !validOutletIds.has(id)) continue
    if (validOutletIds.size === 0 && fallbackName && !adalahOutletPenjualan(fallbackName, 'internal')) continue

    const infoKanal = identifikasiKanalOrder(o.channel || '', o.sales_source || '')
    const baseAmt = Number(o.total_amount) || 0
    const disc = Number(o.discount_amount) || 0
    const promo = Number(o.promo_subsidy) || 0

    // Sesuai rumus Rangkuman Penjualan (posReportKpi.ts):
    // - Food Apps: total_amount sudah harga menu utuh (Gross). Potongan = promo_subsidy (kecuali TikTok GO = 0). Net = Gross - Potongan.
    // - POS Kasir / Offline: total_amount sudah Net. Potongan = discount_amount. Gross = Net + Potongan.
    const deduction = infoKanal.isFoodApp ? (infoKanal.isTikTokGo ? 0 : promo) : disc
    const grossAmt = infoKanal.isFoodApp ? baseAmt : baseAmt + deduction
    const netAmt = Math.max(0, grossAmt - deduction)

    mapOmzet[id] = (mapOmzet[id] || 0) + grossAmt
    mapOmzetBersih[id] = (mapOmzetBersih[id] || 0) + netAmt
    mapPotongan[id] = (mapPotongan[id] || 0) + deduction
    mapCount[id] = (mapCount[id] || 0) + 1
    if (fallbackName && !mapFallbackNama[id]) mapFallbackNama[id] = fallbackName

    if (!mapKanal[id]) mapKanal[id] = {}
    if (!mapKanal[id][infoKanal.label]) {
      mapKanal[id][infoKanal.label] = {
        kanal: infoKanal.label,
        omzetKotor: 0,
        omzetBersih: 0,
        potongan: 0,
        orderCount: 0,
      }
    }
    mapKanal[id][infoKanal.label].omzetKotor += grossAmt
    mapKanal[id][infoKanal.label].omzetBersih += netAmt
    mapKanal[id][infoKanal.label].potongan += deduction
    mapKanal[id][infoKanal.label].orderCount += 1

    omzetTotal += grossAmt
    omzetBersihTotal += netAmt
    potonganTotal += deduction
    totalOrder += 1
  }

  const effectiveOutlets =
    baseOutlets.length > 0
      ? baseOutlets
      : Object.keys(mapCount).map((id) => ({
          id,
          name: mapFallbackNama[id] || `Outlet ${id.slice(0, 6)}`,
          type: 'internal',
        }))

  const allOutlets: OutletTelemetri[] = effectiveOutlets.map((o: any) => ({
    id: o.id,
    nama: o.name,
    type: o.type || 'internal',
    omzet: mapOmzet[o.id] || 0,
    omzetBersih: mapOmzetBersih[o.id] || 0,
    potongan: mapPotongan[o.id] || 0,
    orderCount: mapCount[o.id] || 0,
    rincianKanal: mapKanal[o.id]
      ? Object.values(mapKanal[o.id]).sort((a, b) => b.omzetKotor - a.omzetKotor)
      : [],
  })).sort((a, b) => b.omzet - a.omzet)

  const outletsAktifTransaksi = allOutlets.filter((o) => o.orderCount > 0)
  const outletsNolTransaksi = allOutlets.filter((o) => o.orderCount === 0)
  const aov = totalOrder > 0 ? Math.round(omzetTotal / totalOrder) : 0

  return {
    tanggalLabel: tglLabel,
    tglIso,
    omzetTotal,
    omzetBersihTotal,
    potonganTotal,
    totalOrder,
    aov,
    outletsAktifTransaksi,
    outletsNolTransaksi,
  }
}

function bersihkanNamaMenu(raw: string): string {
  if (!raw) return ''
  if (raw.indexOf('|') === -1) return raw
  let end = raw.length
  const iNote = raw.indexOf('|NOTE|')
  if (iNote !== -1 && iNote < end) end = iNote
  const iParent = raw.indexOf('|PARENT|')
  if (iParent !== -1 && iParent < end) end = iParent
  const iId = raw.indexOf('|ID|')
  if (iId !== -1 && iId < end) end = iId
  return end === raw.length ? raw : raw.slice(0, end)
}

function bangunPenerapHppTanggal(menus: any[], riwayatRows: any[], tgl: string) {
  const indeks = new Map<string, Map<string, Array<{ tgl: string; nilai: number | null }>>>()
  for (const r of riwayatRows) {
    let perKunci = indeks.get(r.menu_item_id)
    if (!perKunci) {
      perKunci = new Map()
      indeks.set(r.menu_item_id, perKunci)
    }
    let titik = perKunci.get(r.kunci)
    if (!titik) {
      titik = []
      perKunci.set(r.kunci, titik)
    }
    titik.push({
      tgl: String(r.berlaku_mulai).slice(0, 10),
      nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    })
  }
  for (const perKunci of indeks.values()) {
    for (const titik of perKunci.values()) titik.sort((a, b) => a.tgl.localeCompare(b.tgl))
  }

  const nilaiPada = (menuId: string) => {
    const perKunci = indeks.get(menuId)
    if (!perKunci) return null
    let hpp_override: number | null = null
    const channel_hpp: Record<string, number> = {}
    for (const [kunci, titik] of perKunci) {
      let nilai: number | null | undefined
      for (const t of titik) {
        if (t.tgl <= tgl) nilai = t.nilai
        else break
      }
      if (nilai === undefined) continue
      if (kunci === 'hpp_override') hpp_override = nilai
      else if (nilai !== null) channel_hpp[kunci] = nilai
    }
    return { hpp_override, channel_hpp }
  }

  const timpa = (m: any): any => {
    if (!m || typeof m !== 'object') return m
    const v = typeof m.id === 'string' ? nilaiPada(m.id) : null
    const salinan: any = v ? { ...m, hpp_override: v.hpp_override, channel_hpp: v.channel_hpp } : { ...m }
    if (Array.isArray(m.package_items)) {
      salinan.package_items = m.package_items.map((p: any) =>
        p && p.component ? { ...p, component: timpa(p.component) } : p
      )
    }
    return salinan
  }

  const byId = new Map<string, any>()
  const byName = new Map<string, any>()
  for (const m of menus) {
    const t = timpa(m)
    if (m?.id) byId.set(m.id, t)
    if (m?.name) byName.set(bersihkanNamaMenu(m.name), t)
  }
  return { byId, byName }
}

function hitungHppItem(
  menuItem: any,
  outletType?: string,
  fallbackName?: string,
  byName?: Map<string, any>,
  channel?: string | null,
  menuItemId?: string | null,
  byId?: Map<string, any>
): number {
  let itemObj = menuItem
  if (!itemObj && menuItemId && byId?.has(menuItemId)) {
    itemObj = byId.get(menuItemId)
  }
  if ((!itemObj || (!itemObj.hpp_override && !itemObj.channel_hpp && !itemObj.is_package)) && fallbackName && byName) {
    const cleanKey = bersihkanNamaMenu(fallbackName)
    if (byName.has(cleanKey)) {
      itemObj = byName.get(cleanKey)
    }
  }
  if (!itemObj) return 0

  const normCh = channel ? channel.toLowerCase() : null
  const isMitra = outletType === 'mitra'
  let baseHpp = 0
  let channelHppVal: number | null = null

  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    channelHppVal = itemObj.channel_hpp[normCh] ?? null
  }

  if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
    baseHpp = Number(channelHppVal)
  } else if (itemObj.hpp_override !== null && itemObj.hpp_override !== undefined && Number(itemObj.hpp_override) > 0) {
    baseHpp = Number(itemObj.hpp_override)
  } else if (itemObj.is_package && Array.isArray(itemObj.package_items)) {
    baseHpp = itemObj.package_items.reduce((sum: number, pkg: any) => {
      const compHpp = pkg.component ? hitungHppItem(pkg.component, undefined, undefined, undefined, channel) : 0
      const qty = pkg.quantity || 1
      return sum + compHpp * qty
    }, 0)
  }

  return isMitra && baseHpp > 0 ? Math.round(baseHpp * 1.1) : baseHpp
}

function terapkanItemDanHppKeRingkasan(
  ringkasan: RingkasanHari,
  itemsData: any[],
  validOutletIds: Set<string>,
  outletTypeMap: Map<string, string>,
  penerapHpp: { byId: Map<string, any>; byName: Map<string, any> }
) {
  const perMenuGlobal: Record<string, { qty: number; omzet: number }> = {}
  const perMenuCabang: Record<string, Record<string, { qty: number; omzet: number }>> = {}
  const porsiPerCabang: Record<string, number> = {}
  const hppPerCabang: Record<string, number> = {}

  let totalPorsiGlobal = 0
  let totalHppGlobal = 0

  for (const it of itemsData) {
    const ord = it.orders || {}
    const ordOutletId = ord.outlet_id
    if (validOutletIds.size > 0 && ordOutletId && !validOutletIds.has(ordOutletId)) continue

    const nama = bersihkanNamaMenu(it.menu_item_name || 'Menu Lain')
    const qty = Number(it.quantity) || 1
    const sub = Number(it.subtotal) || 0

    if (!perMenuGlobal[nama]) perMenuGlobal[nama] = { qty: 0, omzet: 0 }
    perMenuGlobal[nama].qty += qty
    perMenuGlobal[nama].omzet += sub
    totalPorsiGlobal += qty

    const outType = ordOutletId ? outletTypeMap.get(ordOutletId) : 'internal'
    const ordChannel = ord.channel || ord.sales_source || null
    const menuItem =
      (it.menu_item_id ? penerapHpp.byId.get(it.menu_item_id) : null) || penerapHpp.byName.get(nama)
    const unitHpp = hitungHppItem(
      menuItem,
      outType,
      nama,
      penerapHpp.byName,
      ordChannel,
      it.menu_item_id,
      penerapHpp.byId
    )
    const itemHpp = unitHpp * qty
    totalHppGlobal += itemHpp

    if (ordOutletId) {
      porsiPerCabang[ordOutletId] = (porsiPerCabang[ordOutletId] || 0) + qty
      hppPerCabang[ordOutletId] = (hppPerCabang[ordOutletId] || 0) + itemHpp
      if (!perMenuCabang[ordOutletId]) perMenuCabang[ordOutletId] = {}
      if (!perMenuCabang[ordOutletId][nama]) perMenuCabang[ordOutletId][nama] = { qty: 0, omzet: 0 }
      perMenuCabang[ordOutletId][nama].qty += qty
      perMenuCabang[ordOutletId][nama].omzet += sub
    }
  }

  const semuaMenuGlobal = Object.entries(perMenuGlobal)
    .map(([nama, val]) => ({ nama, ...val }))
    .filter((m) => m.qty > 0)

  ringkasan.topMenu = [...semuaMenuGlobal].sort((a, b) => b.qty - a.qty).slice(0, 10)
  ringkasan.menuTersepi = [...semuaMenuGlobal].sort((a, b) => a.qty - b.qty).slice(0, 5)
  ringkasan.totalPorsi = totalPorsiGlobal
  ringkasan.totalHpp = Math.round(totalHppGlobal)
  const netJaringan = ringkasan.omzetBersihTotal ?? ringkasan.omzetTotal
  ringkasan.labaKotorTotal = Math.max(0, Math.round(netJaringan - totalHppGlobal))

  for (const out of ringkasan.outletsAktifTransaksi) {
    const porsi = porsiPerCabang[out.id] || 0
    const hpp = Math.round(hppPerCabang[out.id] || 0)
    const netCabang = out.omzetBersih ?? out.omzet
    out.totalPorsi = porsi
    out.totalHpp = hpp
    out.labaKotor = Math.max(0, Math.round(netCabang - hpp))

    const menuCabangMap = perMenuCabang[out.id] || {}
    const daftarMenuCabang = Object.entries(menuCabangMap)
      .map(([nama, val]) => ({ nama, ...val }))
      .filter((m) => m.qty > 0)
    out.topMenuCabang = [...daftarMenuCabang].sort((a, b) => b.qty - a.qty).slice(0, 5)
    out.menuTersepiCabang = [...daftarMenuCabang].sort((a, b) => a.qty - b.qty).slice(0, 3)
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
    const wibH2 = new Date(wib.getTime() - 2 * 24 * 60 * 60 * 1000)
    const tglH2Str = wibH2.toISOString().slice(0, 10)

    const startH2 = `${tglH2Str}T00:00:00+07:00`
    const endH2 = `${tglKemarinStr}T00:00:00+07:00`
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
      resMenuItems,
      resRiwayatHpp,
      ordersH2,
      resPettyH2,
      resExpH2,
      resCeklistHarian,
      resCashAdvances,
    ] = await Promise.all([
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, discount_amount, promo_subsidy, channel, sales_source, status, outlet_id, outlets(name)')
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
          .select('id, total_amount, discount_amount, promo_subsidy, channel, sales_source, status, outlet_id, outlets(name)')
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
          .select('id, menu_item_id, quantity, menu_item_name, subtotal, orders!inner(created_at, status, outlet_id, channel, sales_source)')
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
          .select('id, menu_item_id, quantity, menu_item_name, subtotal, orders!inner(created_at, status, outlet_id, channel, sales_source)')
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
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, slug)')
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
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, slug)')
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
        .select('id, name, type, slug, is_active')
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
        .limit(100)
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
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, slug)')
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
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, slug)')
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
      fetchAllRows(
        sb,
        'stok_waste_reports',
        (q) =>
          q
            .select('id, qty, reason, status, created_at, outlet_id, bahan_baku_id, outlets(name, type, slug), bahan_baku(nama, satuan)')
            .neq('status', 'REJECTED')
            .gte('created_at', start30)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true }),
        1000,
        5000
      )
        .then((rows) => ({ data: rows }))
        .catch((err) => {
          console.error('[telemetriNyata] reject waste:', err)
          return { data: [] }
        }),
      sb
        .from('orders')
        .select('id, total_amount, created_at, void_at, outlet_id, outlets(name)')
        .or(`and(created_at.gte.${startToday},created_at.lt.${endToday}),and(void_at.gte.${startToday},void_at.lt.${endToday})`)
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
        .select('id, total_amount, created_at, void_at, outlet_id, outlets(name)')
        .or(`and(created_at.gte.${startKemarin},created_at.lt.${endKemarin}),and(void_at.gte.${startKemarin},void_at.lt.${endKemarin})`)
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
        .limit(250)
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
        .limit(300)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error petty cash hari ini:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject petty cash hari ini:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, type, outlet_id, outlets(name)')
        .eq('expense_date', tglStr)
        .eq('type', 'expense')
        .order('amount', { ascending: false })
        .limit(300)
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
        .limit(300)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error petty cash kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject petty cash kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, type, outlet_id, outlets(name)')
        .eq('expense_date', tglKemarinStr)
        .eq('type', 'expense')
        .order('amount', { ascending: false })
        .limit(300)
        .then((r: any) => {
          if (r.error) console.error('[telemetriNyata] error expenses kemarin:', r.error)
          return r
        }, (err: any) => {
          console.error('[telemetriNyata] reject expenses kemarin:', err)
          return { data: [] }
        }),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, type, outlet_id, outlets(name, type)')
        .gte('expense_date', `${tglStr.slice(0, 7)}-01`)
        .eq('type', 'expense')
        .order('amount', { ascending: false })
        .limit(1000)
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
        .in('status', ['reconciled', 'paid', 'approved'])
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
      fetchAllRows(
        sb,
        'monitoring_view_spv',
        (q) =>
          q
            .select('outlet_id, bahan_baku_id, current_qty, last_opname_date, saldo_is_gram, outlets(name), bahan_baku(nama, satuan, satuan_kecil, faktor_tampilan, faktor_konversi, faktor_tengah)')
            .order('outlet_id', { ascending: true })
            .order('bahan_baku_id', { ascending: true }),
        1000,
        2500
      )
        .then((rows) => ({ data: rows }))
        .catch((err) => {
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
            bahan_baku(nama, satuan, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(60)
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn surat_jalan:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject surat_jalan:', err)
          return { data: [] }
        }),
      sb
        .from('menu_items')
        .select('id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))')
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn menu_items:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject menu_items:', err)
          return { data: [] }
        }),
      sb
        .from('menu_hpp_riwayat')
        .select('menu_item_id, kunci, nilai, berlaku_mulai')
        .order('id', { ascending: true })
        .limit(2000)
        .then((r: any) => {
          if (r.error) console.warn('[telemetriNyata] warn menu_hpp_riwayat:', r.error.message)
          return r
        }, (err: any) => {
          console.warn('[telemetriNyata] reject menu_hpp_riwayat:', err)
          return { data: [] }
        }),
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, discount_amount, promo_subsidy, channel, sales_source, status, outlet_id, outlets(name)')
          .gte('created_at', startH2)
          .lt('created_at', endH2)
          .in('status', ['completed', 'settled'])
          .order('id', { ascending: true })
      ).catch((err) => {
        console.warn('[telemetriNyata] warn orders H-2:', err)
        return []
      }),
      sb
        .from('petty_cash_expenses')
        .select('id, amount, outlet_id, outlets(name)')
        .eq('expense_date', tglH2Str)
        .is('deleted_at', null)
        .limit(300)
        .then((r: any) => r, () => ({ data: [] })),
      sb
        .from('expenses')
        .select('id, amount, category, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglH2Str)
        .eq('type', 'expense')
        .limit(300)
        .then((r: any) => r, () => ({ data: [] })),
      sb
        .from('ceklist_harian')
        .select(
          'id, outlet_id, nama_am, tanggal, temuan, perbaikan, catatan, ditinjau_pada, outlets(name), ceklist_harian_item(kategori, sub_item, nilai, keterangan)'
        )
        .in('tanggal', [tglStr, tglKemarinStr])
        .order('created_at', { ascending: false })
        .limit(100)
        .then((r: any) => r, () => ({ data: [] })),
      sb
        .from('cash_advances')
        .select(
          'id, staff_id, amount, amount_requested, remaining, reason, status, status_hr, created_at, outlet_staff:outlet_staff!cash_advances_staff_id_fkey(name, role, outlet_id, outlets:outlets!outlet_staff_outlet_id_fkey(name))'
        )
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .limit(60)
        .then((r: any) => r, () => ({ data: [] })),
    ])

    const rawOutlets = (resOutlets.data || []).filter((o: any) =>
      adalahOutletPenjualan(o.name, o.type, o.code, o.slug)
    )
    const validOutletIds = new Set<string>(rawOutlets.map((o: any) => String(o.id)))
    const outletTypeMap = new Map<string, string>()
    for (const o of rawOutlets) {
      outletTypeMap.set(o.id, o.type || 'internal')
    }

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
      'area_manager',
      'regional_manager',
      'korlap',
      'spv',
    ])

    const ringkasanHariIni = hitungRingkasan(ordersHariIni, rawOutlets, `Hari Ini (${tglStr})`, tglStr)
    const ringkasanKemarin = hitungRingkasan(ordersKemarin, rawOutlets, `Kemarin (${tglKemarinStr})`, tglKemarinStr)

    const masterMenus = (resMenuItems?.data || []) as any[]
    const masterRiwayatHpp = (resRiwayatHpp?.data || []) as any[]
    const penerapHppHariIni = bangunPenerapHppTanggal(masterMenus, masterRiwayatHpp, tglStr)
    const penerapHppKemarin = bangunPenerapHppTanggal(masterMenus, masterRiwayatHpp, tglKemarinStr)

    terapkanItemDanHppKeRingkasan(ringkasanHariIni, items as any[], validOutletIds, outletTypeMap, penerapHppHariIni)
    terapkanItemDanHppKeRingkasan(ringkasanKemarin, itemsKemarin as any[], validOutletIds, outletTypeMap, penerapHppKemarin)
    const sortedMenu = ringkasanHariIni.topMenu || []
    const sortedMenuKemarin = ringkasanKemarin.topMenu || []

    // Kehadiran / HRD Kru Outlet Hari Ini & Kemarin (H-1)
    const isLateAttRow = (a: any) =>
      a.status !== 'telat_toleransi' &&
      (a.status === 'telat' || a.status === 'terlambat' || Number(a.telat_menit) > 0)

    const att = (resAtt.data || []).filter(isOutletCabang)
    const attKemarin = (resAttKemarin?.data || []).filter(isOutletCabang)
    const attLateRaw = att.filter(isLateAttRow)
    const attKemarinLateRaw = attKemarin.filter(isLateAttRow)

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

    // Staf Telat Kru Outlet (Hari Ini & Kemarin) — diselaraskan dengan kehadiranTelat agar tidak kontradiktif
    const lateFiltered = (resLate.data || []).filter(isOutletCabang)
    const lateKemarinFiltered = (resLateKemarin?.data || []).filter(isOutletCabang)
    const allLateStaffIds = Array.from(
      new Set([
        ...attLateRaw.map((a: any) => a.outlet_staff_id),
        ...attKemarinLateRaw.map((a: any) => a.outlet_staff_id),
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

    const filterKruLateRows = (rows: any[]) =>
      rows.filter((a: any) => {
        const role = (staffMap[a.outlet_staff_id]?.role || '').toLowerCase()
        return !ROLE_BUKAN_KRU_OUTLET.has(role)
      })

    const mapLateRows = (rows: any[]): StafTelatTelemetri[] =>
      filterKruLateRows(rows)
        .sort((a: any, b: any) => (Number(b.telat_menit) || 0) - (Number(a.telat_menit) || 0))
        .slice(0, 15)
        .map((a: any) => ({
          nama: staffMap[a.outlet_staff_id]?.name || 'Kru',
          outlet: a.outlets?.name || 'Cabang',
          telatMenit: Number(a.telat_menit) || 0,
        }))

    const kruLateHariIni = filterKruLateRows(attLateRaw.length >= lateFiltered.length ? attLateRaw : lateFiltered)
    const kruLateKemarin = filterKruLateRows(attKemarinLateRaw.length >= lateKemarinFiltered.length ? attKemarinLateRaw : lateKemarinFiltered)

    const kehadiranTotal = att.length
    const kehadiranTelat = kruLateHariIni.length
    const kehadiranTepatWaktu = Math.max(0, kehadiranTotal - kehadiranTelat)
    const persenOnTime = kehadiranTotal > 0 ? Math.round((kehadiranTepatWaktu / kehadiranTotal) * 100) : 100

    const kehadiranTotalKemarin = attKemarin.length
    const kehadiranTelatKemarin = kruLateKemarin.length
    const kehadiranTepatWaktuKemarin = Math.max(0, kehadiranTotalKemarin - kehadiranTelatKemarin)
    const persenOnTimeKemarin =
      kehadiranTotalKemarin > 0 ? Math.round((kehadiranTepatWaktuKemarin / kehadiranTotalKemarin) * 100) : 100

    const stafTelat = mapLateRows(kruLateHariIni)
    const stafTelatKemarin = mapLateRows(kruLateKemarin)

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

    const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'
    const TEST_OUTLET_ID_ALT = '04f58143-8da8-49af-b87f-50435f064137'
    const GUDANG_PUSAT_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'

    const isBukanOutletTest = (r: any) => {
      const oId = String(r.outlet_id || '')
      if (oId === TEST_OUTLET_ID || oId === TEST_OUTLET_ID_ALT) return false
      const outType = (r.outlets?.type || '').toLowerCase()
      if (outType === 'test') return false
      const outName = r.outlets?.name || ''
      if (/\b(tes|test|trial|demo)\b/i.test(outName)) return false
      return true
    }

    const wasteRowsRaw = (resWaste?.data || []) as any[]
    const wasteRows = wasteRowsRaw.filter(
      (r: any) => String(r.status || 'PENDING').toUpperCase() !== 'REJECTED' && isBukanOutletTest(r)
    )
    let totalEstKerugianExact = 0
    let laporanHariIniCount = 0
    let estKerugianHariIniExact = 0
    let laporanKemarinCount = 0
    let estKerugianKemarinExact = 0
    let estKerugianH2Exact = 0
    const bahanMap: Record<string, { nama: string; satuan: string; totalQty: number; frekuensi: number; reasons: Record<string, number>; estKerugianExact: number }> = {}
    const outletWasteMap: Record<string, { nama: string; frekuensi: number; totalQty: number; estKerugianExact: number }> = {}
    const rincianHariIni: WasteLaporanItem[] = []
    const rincianKemarin: WasteLaporanItem[] = []
    const outletHariIniMap: Record<string, { outlet: string; totalLaporan: number; totalQty: number; estKerugianExact: number; items: string[] }> = {}
    const outletKemarinMap: Record<string, { outlet: string; totalLaporan: number; totalQty: number; estKerugianExact: number; items: string[] }> = {}

    for (const r of wasteRows) {
      const bNama = r.bahan_baku?.nama || 'Bahan Baku'
      const sat = r.bahan_baku?.satuan || 'unit'
      const qty = Number(r.qty) || 0
      const hBeli = priceMap[r.bahan_baku_id] || 0
      const exactLoss = qty * hBeli
      const estLoss = Math.round(exactLoss)
      totalEstKerugianExact += exactLoss

      const outNama = r.outlets?.name || 'Cabang'
      const itemLaporan: WasteLaporanItem = {
        id: r.id,
        outlet: outNama,
        bahan: bNama,
        qty: Math.round(qty * 100) / 100,
        satuan: sat,
        reason: (r.reason || 'Lainnya').trim(),
        status: (r.status || 'APPROVED').toUpperCase(),
        estKerugianRp: estLoss,
        waktu: r.created_at ? new Date(Date.parse(r.created_at) + 7 * 3600000).toISOString().slice(11, 16) : undefined,
      }

      if (r.created_at) {
        const wibWasteDate = new Date(Date.parse(r.created_at) + 7 * 3600000).toISOString().slice(0, 10)
        if (wibWasteDate === tglStr) {
          laporanHariIniCount++
          estKerugianHariIniExact += exactLoss
          rincianHariIni.push(itemLaporan)
          if (!outletHariIniMap[outNama]) {
            outletHariIniMap[outNama] = { outlet: outNama, totalLaporan: 0, totalQty: 0, estKerugianExact: 0, items: [] }
          }
          outletHariIniMap[outNama].totalLaporan++
          outletHariIniMap[outNama].totalQty += qty
          outletHariIniMap[outNama].estKerugianExact += exactLoss
          outletHariIniMap[outNama].items.push(`${bNama} ${itemLaporan.qty} ${sat}`)
        } else if (wibWasteDate === tglKemarinStr) {
          laporanKemarinCount++
          estKerugianKemarinExact += exactLoss
          rincianKemarin.push(itemLaporan)
          if (!outletKemarinMap[outNama]) {
            outletKemarinMap[outNama] = { outlet: outNama, totalLaporan: 0, totalQty: 0, estKerugianExact: 0, items: [] }
          }
          outletKemarinMap[outNama].totalLaporan++
          outletKemarinMap[outNama].totalQty += qty
          outletKemarinMap[outNama].estKerugianExact += exactLoss
          outletKemarinMap[outNama].items.push(`${bNama} ${itemLaporan.qty} ${sat}`)
        } else if (wibWasteDate === tglH2Str) {
          estKerugianH2Exact += exactLoss
        }
      }

      if (!bahanMap[bNama]) {
        bahanMap[bNama] = { nama: bNama, satuan: sat, totalQty: 0, frekuensi: 0, reasons: {}, estKerugianExact: 0 }
      }
      bahanMap[bNama].totalQty += qty
      bahanMap[bNama].frekuensi += 1
      bahanMap[bNama].estKerugianExact += exactLoss
      const reas = (r.reason || 'Lainnya').trim()
      bahanMap[bNama].reasons[reas] = (bahanMap[bNama].reasons[reas] || 0) + 1

      if (!outletWasteMap[outNama]) {
        outletWasteMap[outNama] = { nama: outNama, frekuensi: 0, totalQty: 0, estKerugianExact: 0 }
      }
      outletWasteMap[outNama].frekuensi += 1
      outletWasteMap[outNama].totalQty += qty
      outletWasteMap[outNama].estKerugianExact += exactLoss
    }

    const totalEstKerugianRp = Math.round(totalEstKerugianExact)
    const estKerugianHariIniRp = Math.round(estKerugianHariIniExact)
    const estKerugianKemarinRp = Math.round(estKerugianKemarinExact)
    const estKerugianH2Rp = Math.round(estKerugianH2Exact)

    const topBahanWaste = Object.values(bahanMap)
      .sort((a, b) => b.estKerugianExact - a.estKerugianExact || b.totalQty - a.totalQty)
      .slice(0, 5)
      .map(b => {
        const sortedReasons = Object.entries(b.reasons).sort((x, y) => y[1] - x[1])
        const nonGeneric = sortedReasons.filter(([k]) => !/^(lainnya|-)$/i.test(k.trim()))
        const topReason = (nonGeneric[0] || sortedReasons[0])?.[0] || '-'
        return {
          nama: b.nama,
          satuan: b.satuan,
          totalQty: Math.round(b.totalQty * 100) / 100,
          frekuensi: b.frekuensi,
          alasanDominan: topReason,
          estKerugianRp: Math.round(b.estKerugianExact),
        }
      })

    const topOutletWaste = Object.values(outletWasteMap)
      .sort((a, b) => b.estKerugianExact - a.estKerugianExact || b.frekuensi - a.frekuensi)
      .slice(0, 5)
      .map(o => ({
        nama: o.nama,
        frekuensi: o.frekuensi,
        totalQty: Math.round(o.totalQty * 10) / 10,
        estKerugianRp: Math.round(o.estKerugianExact),
      }))

    const waste: WasteTelemetri = {
      totalLaporan30Hari: wasteRows.length,
      totalEstKerugianRp,
      topBahan: topBahanWaste,
      topOutlet: topOutletWaste,
      laporanHariIniCount,
      estKerugianHariIniRp,
      rincianHariIni,
      rekapOutletHariIni: Object.values(outletHariIniMap)
        .map((o) => ({
          outlet: o.outlet,
          totalLaporan: o.totalLaporan,
          totalQty: Math.round(o.totalQty * 100) / 100,
          estKerugianRp: Math.round(o.estKerugianExact),
          items: o.items,
        }))
        .sort((a, b) => b.estKerugianRp - a.estKerugianRp),
      laporanKemarinCount,
      estKerugianKemarinRp,
      rincianKemarin,
      rekapOutletKemarin: Object.values(outletKemarinMap)
        .map((o) => ({
          outlet: o.outlet,
          totalLaporan: o.totalLaporan,
          totalQty: Math.round(o.totalQty * 100) / 100,
          estKerugianRp: Math.round(o.estKerugianExact),
          items: o.items,
        }))
        .sort((a, b) => b.estKerugianRp - a.estKerugianRp),
    }

    // ─────────────────────────────────────────────────────────── Void & Pembatalan Transaksi POS (Hari Ini & Kemarin)
    const mapVoidRows = (rows: any[]) => {
      const validRows = rows.filter(isOutletCabang)
      let totalNilai = 0
      const daftar = validRows.map((v) => {
        const amt = Number(v.total_amount) || 0
        totalNilai += amt
        const tsVoid = v.void_at || v.created_at
        const waktuWib = tsVoid
          ? new Date(tsVoid).toLocaleTimeString('id-ID', {
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
      return { totalVoid: validRows.length, totalNilai, daftar }
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
    const shiftRows = ((resShifts?.data || []) as any[]).filter(isOutletCabang)
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

    const rawShiftsKemarin = ((resShiftsKemarin?.data || []) as any[]).filter(isOutletCabang)
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
    const rawSelisih = ((resSelisih?.data || []) as any[]).filter(isOutletCabang)

    const gabungPengeluaranHarian = (pettyRows: any[], expRows: any[], defaultTgl: string): FinanceItemPengeluaran[] =>
      [
        ...pettyRows
          .filter(isBukanOutletTest)
          .map((r: any) => ({
            id: r.id,
            nominal: Number(r.amount) || 0,
            deskripsi: r.description || 'Pengeluaran kas kecil',
            kategori: r.category || 'petty_cash',
            outlet: r.outlets?.name || 'Cabang',
            tipe: 'petty_cash' as const,
            tanggal: r.expense_date || defaultTgl,
          })),
        ...expRows
          .filter(
            (r: any) =>
              isBukanOutletTest(r) &&
              !(r.category === 'joint_expense' && String(r.expense_date || defaultTgl) >= '2026-10-01')
          )
          .map((r: any) => ({
            id: r.id,
            nominal: Number(r.amount) || 0,
            deskripsi: r.description || 'Operasional outlet',
            kategori: r.category || 'operasional',
            outlet: r.outlets?.name || 'Pusat',
            tipe: 'operasional' as const,
            tanggal: r.expense_date || defaultTgl,
          })),
      ].sort((a, b) => b.nominal - a.nominal)

    const buatRekapOutletPengeluaran = (items: FinanceItemPengeluaran[]): FinanceRekapOutletPengeluaran[] => {
      const peta = new Map<string, FinanceRekapOutletPengeluaran>()
      for (const item of items) {
        const key = item.outlet || 'Pusat'
        const cur = peta.get(key) ?? { outlet: key, totalNominal: 0, jumlahTransaksi: 0, rincian: [] }
        cur.totalNominal += item.nominal
        cur.jumlahTransaksi += 1
        if (cur.rincian.length < 8) {
          cur.rincian.push(`${item.deskripsi} (${formatRupiah(item.nominal)})`)
        }
        peta.set(key, cur)
      }
      return Array.from(peta.values()).sort((a, b) => b.totalNominal - a.totalNominal)
    }

    const itemsHariIni = gabungPengeluaranHarian(rawPetty, rawExp, tglStr)
    const totalNominalHariIni = itemsHariIni.reduce((sum, item) => sum + item.nominal, 0)
    const rekapOutletExpHariIni = buatRekapOutletPengeluaran(itemsHariIni)

    const itemsKemarinPengeluaran = gabungPengeluaranHarian(rawPettyKemarin, rawExpKemarin, tglKemarinStr)
    const totalNominalKemarin = itemsKemarinPengeluaran.reduce((sum, item) => sum + item.nominal, 0)
    const rekapOutletExpKemarin = buatRekapOutletPengeluaran(itemsKemarinPengeluaran)

    const validExpBulan: FinanceItemPengeluaran[] = rawExpBulan
      .filter(
        (r: any) =>
          isBukanOutletTest(r) &&
          !(r.category === 'joint_expense' && String(r.expense_date || tglStr) >= '2026-10-01')
      )
      .map((r: any) => ({
        id: r.id,
        nominal: Number(r.amount) || 0,
        deskripsi: r.description || '-',
        kategori: r.category || 'beban_operasional',
        outlet: r.outlets?.name || 'Pusat',
        tipe: 'operasional' as const,
        tanggal: r.expense_date || tglStr,
      }))
    const totalNominalExpBulan = validExpBulan.reduce((sum, item) => sum + item.nominal, 0)
    const topExpBulan = validExpBulan.slice(0, 20)

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

    // Aturan App Finance: jika sales_date kosong, tanggal jual = occurred_at (WIB) dikurangi 1 hari
    const hitungTanggalJualSetoran = (s: any): string => {
      if (s.sales_date) return String(s.sales_date).slice(0, 10)
      if (s.occurred_at) {
        const ms = Date.parse(s.occurred_at) + 7 * 3600000 - 86_400_000
        if (!isNaN(ms)) return new Date(ms).toISOString().slice(0, 10)
      }
      return '-'
    }

    const daftarSetoranTerbaru: FinanceSetoran[] = rawSetoran.map((s: any) => ({
      id: s.id,
      nominal: Number(s.amount) || 0,
      outlet: s.outlets?.name || 'Cabang',
      tanggalJual: hitungTanggalJualSetoran(s),
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
      const tj = hitungTanggalJualSetoran(s)
      const ex = rekapMap.get(tj) || { totalNominal: 0, jumlah: 0 }
      ex.totalNominal += Number(s.amount) || 0
      ex.jumlah += 1
      rekapMap.set(tj, ex)
    }
    const rekapPerTanggalJual = Array.from(rekapMap.entries())
      .map(([tanggalJual, val]) => ({ tanggalJual, totalNominal: val.totalNominal, jumlah: val.jumlah }))
      .sort((a, b) => b.tanggalJual.localeCompare(a.tanggalJual))

    const totalFisikKasKemarin = rawShiftsKemarin.reduce((sum: number, sh: any) => sum + (Number(sh.actual_ending_cash) || 0), 0)
    const setoranUntukSalesKemarin = rawSetoran.filter((s: any) => hitungTanggalJualSetoran(s) === tglKemarinStr)
    const totalSetoranDirekapKemarin = setoranUntukSalesKemarin.reduce((sum: number, s: any) => sum + (Number(s.amount) || 0), 0)
    const outletSetorKemarin = new Set(setoranUntukSalesKemarin.map((s: any) => s.outlet_id))
    const seenShiftOutletKemarin = new Set<string>()
    let sudahDirekapKemarin = 0
    let belumDirekapKemarin = 0
    const daftarBelumSetorSet = new Set<string>()
    const rincianShiftCabangKemarin: FinanceShiftCabangKemarin[] = []
    for (const sh of rawShiftsKemarin) {
      const sudah = outletSetorKemarin.has(sh.outlet_id)
      const oKey = sh.outlet_id || sh.outlets?.name || sh.id
      if (!seenShiftOutletKemarin.has(oKey)) {
        seenShiftOutletKemarin.add(oKey)
        if (sudah) {
          sudahDirekapKemarin++
        } else {
          belumDirekapKemarin++
          if (sh.outlets?.name) daftarBelumSetorSet.add(sh.outlets.name)
        }
      }
      rincianShiftCabangKemarin.push({
        outlet: sh.outlets?.name || 'Cabang',
        kasir: sh.staff?.name || '-',
        fisik: Number(sh.actual_ending_cash) || 0,
        seharusnya: Number(sh.expected_ending_cash) || 0,
        selisih: Number(sh.variance) || 0,
        sudahDirekap: sudah,
      })
    }

    const finance: FinanceTelemetri = {
      pengeluaranHariIni: {
        totalNominal: totalNominalHariIni,
        jumlahTransaksi: itemsHariIni.length,
        topPengeluaran: itemsHariIni.slice(0, 40),
        rekapPerOutlet: rekapOutletExpHariIni,
      },
      pengeluaranKemarin: {
        totalNominal: totalNominalKemarin,
        jumlahTransaksi: itemsKemarinPengeluaran.length,
        topPengeluaran: itemsKemarinPengeluaran.slice(0, 40),
        rekapPerOutlet: rekapOutletExpKemarin,
      },
      pengeluaranBulanIni: {
        totalNominal: totalNominalExpBulan,
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
          jumlahOutletClosed: seenShiftOutletKemarin.size || rawShiftsKemarin.length,
          sudahDirekap: sudahDirekapKemarin,
          belumDirekap: belumDirekapKemarin,
          daftarBelumSetor: Array.from(daftarBelumSetorSet),
          rincianCabang: rincianShiftCabangKemarin,
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
    const seenStokPair = new Set<string>()

    for (const r of rawSaldoStok) {
      const oId = r.outlet_id || ''
      const bId = r.bahan_baku_id || 'unknown'
      const isGudangPusat = oId === GUDANG_PUSAT_ID
      const isCabangValid = validOutletIds.size === 0 || validOutletIds.has(oId)
      if (!isGudangPusat && !isCabangValid) continue

      const pairKey = `${oId}:${bId}`
      if (seenStokPair.has(pairKey)) continue
      seenStokPair.add(pairKey)

      const bNama = r.bahan_baku?.nama || 'Bahan Baku'
      const bSat = r.bahan_baku?.satuan || 'unit'
      const rawQty = Number(r.current_qty) || 0
      const fPenuh =
        r.bahan_baku?.faktor_tengah && r.bahan_baku?.faktor_tampilan
          ? Number(r.bahan_baku.faktor_tampilan) || 0
          : Number(r.bahan_baku?.faktor_tampilan) || Number(r.bahan_baku?.faktor_konversi) || 0
      const qty =
        r.saldo_is_gram && r.bahan_baku?.satuan_kecil && fPenuh > 0
          ? Math.round((rawQty / fPenuh) * 100) / 100
          : Math.round(rawQty * 100) / 100
      const outNama = r.outlets?.name || 'Cabang'

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
      if (isGudangPusat) {
        item.stokGudangPusat = Math.round((item.stokGudangPusat + qty) * 100) / 100
      } else {
        item.totalStokJaringan = Math.round((item.totalStokJaringan + qty) * 100) / 100
        if (qty <= 0) {
          item.outletKritisCount += 1
        }
        item.daftarOutlet.push({
          outlet: outNama,
          qty,
          opnameTerakhir: r.last_opname_date || null,
        })
      }
    }

    const saldoStok: SaldoStokItemTelemetri[] = Array.from(stokBahanMap.values())
      .sort((a, b) => b.outletKritisCount - a.outletKritisCount || b.totalStokJaringan - a.totalStokJaringan)

    // ─────────────────────────────────────────────────────────── Distribusi & Pengiriman Surat Jalan
    const rawSj = (resSuratJalan?.data || []) as any[]
    const daftarSuratJalanTerbaru: SuratJalanTelemetri[] = rawSj.map((sj: any) => {
      const items = sj.surat_jalan_item || []
      const rincianSelisih: string[] = []
      const itemStrs: string[] = []
      let adaSelisih = false
      for (const it of items) {
        const bNama = it.bahan_baku?.nama || 'Item'
        const qKirim = Number(it.qty_dikirim) || 0
        const kirimFmt = formatQtyBahanAdaptif(qKirim, it.bahan_baku)
        itemStrs.push(`${bNama} ${kirimFmt}`)
        const diff = Number(it.selisih) || 0
        if (diff !== 0 || (it.kondisi && it.kondisi !== 'baik')) {
          adaSelisih = true
          const terimaFmt = it.qty_terima != null ? formatQtyBahanAdaptif(Number(it.qty_terima) || 0, it.bahan_baku) : '-'
          const diffFmt = formatQtyBahanAdaptif(diff, it.bahan_baku)
          rincianSelisih.push(
            `${bNama}: kirim ${kirimFmt}, terima ${terimaFmt} (${diff > 0 ? '+' : ''}${diffFmt}) - ${it.kondisi || 'selisih'}`
          )
        }
      }
      return {
        id: sj.id,
        outlet: sj.outlets?.name || 'Cabang',
        status: sj.status || 'draft',
        tanggal: sj.created_at ? String(sj.created_at).slice(0, 10) : '-',
        totalItem: items.length,
        ringkasanItem: itemStrs.join(', '),
        adaSelisih,
        rincianSelisih: rincianSelisih.length > 0 ? rincianSelisih : undefined,
      }
    })

    const daftarSuratJalanMenggantung = daftarSuratJalanTerbaru.filter((s) =>
      ['dikirim', 'dikirim_lengkap'].includes(String(s.status || '').toLowerCase())
    )

    const distribusi: DistribusiTelemetri = {
      totalSuratJalanDikirim: rawSj.length,
      totalSuratJalanMenggantung: daftarSuratJalanMenggantung.length,
      totalSuratJalanAdaSelisih: daftarSuratJalanTerbaru.filter((s) => s.adaSelisih).length,
      daftarSuratJalanMenggantung,
      daftarSuratJalanTerbaru,
    }

    // ─────────────────────────────────────────────────────────── Ulasan Pelanggan (SukaReview External Supabase)
    const reviewData = (resReviews?.data || []) as any[]
    const reviewOutletsData = ((resReviewOutlets?.data || []) as any[]).filter((o: any) => {
      const n = (o.name || '').toLowerCase()
      const s = (o.slug || '').toLowerCase()
      if (n.includes('tes') || n.includes('test')) return false
      if (n.includes('kitchen') || s.includes('kitchen') || n.includes('gudang')) return false
      return true
    })
    let reviewTelemetri: ReviewTelemetri | undefined = undefined
    if (reviewData.length > 0 || reviewOutletsData.length > 0) {
      const outletBerulasan = reviewOutletsData.filter((o: any) => (Number(o.total_reviews) || 0) > 0)
      const totalUlasan =
        outletBerulasan.reduce((acc, o) => acc + (Number(o.total_reviews) || 0), 0) || reviewData.length
      const avg =
        outletBerulasan.length > 0
          ? outletBerulasan.reduce((acc, o) => acc + (Number(o.current_rating) || 0), 0) / outletBerulasan.length
          : reviewData.reduce((acc: number, r: any) => acc + (Number(r.rating) || 0), 0) / (reviewData.length || 1)

      const topCabangRating = outletBerulasan
        .map((o: any) => ({
          outlet: o.name || 'Cabang',
          rating: Number(o.current_rating) || 0,
          totalUlasan: Number(o.total_reviews) || 0,
        }))
        .sort((a, b) => b.rating - a.rating || b.totalUlasan - a.totalUlasan)

      const ulasanNegatifTerbaru = reviewData
        .filter((r: any) => (Number(r.rating) || 0) <= 2 || r.sentiment === 'negative')
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

    // ─────────────────────────────────────────────────────────── Ceklist Harian & Sidak Area Manager (app manager)
    const rawCeklist = (resCeklistHarian?.data || []) as any[]
    const outletMapNama = new Map<string, string>()
    for (const o of rawOutlets) {
      outletMapNama.set(String(o.id), o.name || 'Cabang')
    }

    const ceklistHariIniSet = new Set<string>()
    const ceklistKemarinSet = new Set<string>()
    let totalPerluPerhatianKemarin = 0
    let totalBelumDitinjauRm = 0
    const daftarTemuanTerbaru: CeklistTemuanItem[] = []
    const daftarKunjunganKemarin: CeklistTemuanItem[] = []

    for (const row of rawCeklist) {
      const oId = String(row.outlet_id || '')
      if (validOutletIds.size > 0 && !validOutletIds.has(oId)) continue
      const outNama = row.outlets?.name || outletMapNama.get(oId) || 'Cabang'
      const tglLap = String(row.tanggal || '').slice(0, 10)
      if (tglLap === tglStr) ceklistHariIniSet.add(oId)
      if (tglLap === tglKemarinStr) ceklistKemarinSet.add(oId)

      const sudahDitinjauRm = Boolean(row.ditinjau_pada)
      if (!sudahDitinjauRm) totalBelumDitinjauRm++

      const itemsCek = (row.ceklist_harian_item || []) as any[]
      let nilaiTerburuk: 'baik' | 'perhatian' | 'buruk' = 'baik'
      const catatanBuruk: string[] = []
      for (const it of itemsCek) {
        const n = (it.nilai || 'baik') as 'baik' | 'perhatian' | 'buruk'
        if (n === 'buruk') {
          nilaiTerburuk = 'buruk'
          catatanBuruk.push(`${it.kategori}${it.sub_item ? `.${it.sub_item}` : ''}: ${it.keterangan || 'Buruk'}`)
        } else if (n === 'perhatian' && nilaiTerburuk !== 'buruk') {
          nilaiTerburuk = 'perhatian'
          catatanBuruk.push(`${it.kategori}${it.sub_item ? `.${it.sub_item}` : ''}: ${it.keterangan || 'Perlu perhatian'}`)
        }
      }

      const temuanArr = Array.isArray(row.temuan)
        ? row.temuan.map((x: any) => String(x || '').trim()).filter(Boolean)
        : []
      const perbaikanArr = Array.isArray(row.perbaikan)
        ? row.perbaikan.map((x: any) => String(x || '').trim()).filter(Boolean)
        : []
      const gabungTemuan = temuanArr.length > 0 ? temuanArr : catatanBuruk

      const itemKunjungan: CeklistTemuanItem = {
        outlet: outNama,
        namaAm: row.nama_am || 'Area Manager',
        tanggal: tglLap,
        nilaiTerburuk,
        temuan: gabungTemuan.slice(0, 3),
        perbaikan: perbaikanArr.slice(0, 2),
        sudahDitinjauRm,
      }

      if (tglLap === tglKemarinStr) {
        daftarKunjunganKemarin.push(itemKunjungan)
        if (nilaiTerburuk !== 'baik' || gabungTemuan.length > 0) {
          totalPerluPerhatianKemarin++
        }
      }

      if (nilaiTerburuk !== 'baik' || gabungTemuan.length > 0) {
        daftarTemuanTerbaru.push(itemKunjungan)
      }
    }

    const daftarBelumDicekKemarin = rawOutlets
      .filter((o: any) => !ceklistKemarinSet.has(String(o.id)))
      .map((o: any) => o.name as string)

    const ceklistHarian: CeklistHarianTelemetri = {
      totalOutletWajib: rawOutlets.length,
      totalSudahDicekHariIni: ceklistHariIniSet.size,
      totalSudahDicekKemarin: ceklistKemarinSet.size,
      totalPerluPerhatianKemarin,
      totalBelumDitinjauRm,
      daftarTemuanTerbaru: daftarTemuanTerbaru.slice(0, 6),
      daftarKunjunganKemarin,
      daftarBelumDicekKemarin,
    }

    // ─────────────────────────────────────────────────────────── Kasbon Kru (app HR)
    const rawKasbon = (resCashAdvances?.data || []) as any[]
    let totalPendingCount = 0
    let totalPendingNominal = 0
    let totalAktifCount = 0
    let totalSisaPiutang = 0
    const daftarPendingTerbaru: KasbonItemTelemetri[] = []

    for (const kb of rawKasbon) {
      const staffObj = kb.outlet_staff
      const outNama = staffObj?.outlets?.name || 'Cabang'
      if (/\b(tes|test|trial|demo)\b/i.test(outNama) || /\b(tes|test|trial|demo)\b/i.test(staffObj?.name || '')) {
        continue
      }
      const nominal = Number(kb.amount || kb.amount_requested) || 0
      const sisa = Number(kb.remaining ?? nominal) || 0
      const isPending = kb.status_hr === 'pending' || kb.status === 'pending'
      if (isPending) {
        totalPendingCount++
        totalPendingNominal += nominal
        daftarPendingTerbaru.push({
          id: String(kb.id),
          nama: staffObj?.name || 'Staf',
          role: staffObj?.role || 'crew',
          outlet: outNama,
          nominal,
          sisa,
          alasan: kb.reason || '-',
          status: 'pending',
          tanggal: kb.created_at ? String(kb.created_at).slice(0, 10) : tglStr,
        })
      } else if (kb.status === 'active') {
        totalAktifCount++
        totalSisaPiutang += sisa
      }
    }

    const kasbonHrd: KasbonHrdTelemetri = {
      totalPendingCount,
      totalPendingNominal,
      totalAktifCount,
      totalSisaPiutang,
      daftarPendingTerbaru: daftarPendingTerbaru.slice(0, 5),
    }

    // ─────────────────────────────────────────────────────────── Tren Day-over-Day (H-1 vs H-2)
    const ringkasanH2 = hitungRingkasan((ordersH2 as any[]) || [], rawOutlets, `H-2 (${tglH2Str})`, tglH2Str)
    const itemsH2Pengeluaran = gabungPengeluaranHarian(
      (resPettyH2?.data || []) as any[],
      (resExpH2?.data || []) as any[],
      tglH2Str
    )
    const opexH2 = itemsH2Pengeluaran.reduce((sum, item) => sum + item.nominal, 0)
    const hitungDeltaPersen = (sekarang: number, sebelumnya: number): number | null => {
      if (sebelumnya <= 0) return null
      return Math.round(((sekarang - sebelumnya) / sebelumnya) * 1000) / 10
    }

    const omzetKemarinRef = ringkasanKemarin.omzetBersihTotal ?? ringkasanKemarin.omzetTotal
    const omzetH2Ref = ringkasanH2.omzetBersihTotal ?? ringkasanH2.omzetTotal

    const trenHarian: TrenHarianTelemetri = {
      tanggalH2Iso: tglH2Str,
      omzetH2: omzetH2Ref,
      orderH2: ringkasanH2.totalOrder,
      opexH2,
      wasteH2Rp: estKerugianH2Rp,
      deltaOmzetPersen: hitungDeltaPersen(omzetKemarinRef, omzetH2Ref),
      deltaOrderPersen: hitungDeltaPersen(ringkasanKemarin.totalOrder, ringkasanH2.totalOrder),
      deltaOpexPersen: hitungDeltaPersen(totalNominalKemarin, opexH2),
      deltaWastePersen: hitungDeltaPersen(estKerugianKemarinRp, estKerugianH2Rp),
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
      ceklistHarian,
      kasbonHrd,
      trenHarian,
    }
  } catch (err) {
    console.error('[telemetriNyata] gagal ambil telemetri:', err)
    return null
  }
}
