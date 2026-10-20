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
}

export interface VoidOrderTelemetri {
  totalVoidHariIni: number
  totalNilaiVoidHariIni: number
  daftarOutletVoidHariIni: Array<{
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
}

export interface RingkasanHari {
  tanggalLabel: string
  tglIso: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
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
  }
  selisihKasir: {
    daftarSelisihTerbaru: FinanceSelisihKasir[]
  }
}

export interface TelemetriHariIni {
  tanggalWIB: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outlets: OutletTelemetri[]
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
  topMenu: Array<{ nama: string; qty: number; omzet: number }>
  kehadiranTotal: number
  kehadiranTepatWaktu: number
  kehadiranTelat: number
  persenOnTime: number
  totalOutletAktif: number
  bahanBaku: Array<{ nama: string; satuan: string }>
  stafCutiIzin: StafCutiTelemetri[]
  stafTelat: StafTelatTelemetri[]
  waste?: WasteTelemetri
  voidOrder?: VoidOrderTelemetri
  statusBuka?: StatusBukaTelemetri
  ringkasanHariIni?: RingkasanHari
  ringkasanKemarin?: RingkasanHari
  finance?: FinanceTelemetri
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
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

export function adalahOutletPenjualan(nama: string, tipe: string, kode = ''): boolean {
  const t = (tipe || '').trim().toLowerCase()
  const k = (kode || '').trim().toLowerCase()
  const n = (nama || '').trim().toLowerCase()
  if (TIPE_OUTLET_NON_PENJUALAN.has(t)) return false
  if (k === 'ss-backup') return false
  if (n.includes('gudang') || n.includes('kantor pusat') || n.includes('(hq)')) return false
  return true
}

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
    const amt = Number(o.total_amount) || 0
    mapOmzet[id] = (mapOmzet[id] || 0) + amt
    mapCount[id] = (mapCount[id] || 0) + 1
    omzetTotal += amt
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
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    page++
  }
  return all
}

export async function ambilTelemetriNyata(): Promise<TelemetriHariIni | null> {
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
      resAtt,
      resOutlets,
      resBahan,
      resLeave,
      resLate,
      resWaste,
      resVoid,
      resShifts,
      resPrices,
      resPettyHariIni,
      resExpHariIni,
      resExpBulanIni,
      resPo,
      resSetoran,
      resSelisih,
    ] = await Promise.all([
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, status, outlet_id, outlets(name)')
          .gte('created_at', startToday)
          .lt('created_at', endToday)
          .neq('status', 'cancelled')
          .order('id', { ascending: true })
      ),
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, status, outlet_id, outlets(name)')
          .gte('created_at', startKemarin)
          .lt('created_at', endKemarin)
          .neq('status', 'cancelled')
          .order('id', { ascending: true })
      ),
      fetchAllRows(sb, 'order_items', (q) =>
        q
          .select('id, quantity, menu_item_name, subtotal, orders!inner(created_at, status)')
          .gte('orders.created_at', startToday)
          .lt('orders.created_at', endToday)
          .neq('orders.status', 'cancelled')
          .order('id', { ascending: true })
      ),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code)')
        .eq('type', 'in')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .limit(2000),
      sb
        .from('outlets')
        .select('id, name, type, code, is_active')
        .eq('is_active', true)
        .order('name'),
      sb
        .from('bahan_baku')
        .select('id, nama, satuan')
        .eq('is_active', true)
        .limit(20),
      sb
        .from('leave_requests')
        .select('id, leave_type, status, reason, outlet_staff:staff_id(name, role, outlet_id)')
        .lte('start_date', tglStr)
        .gte('end_date', tglStr)
        .in('status', ['approved', 'pending'])
        .limit(50),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type, outlet_id, outlets(id, name, type, code)')
        .eq('type', 'in')
        .neq('status', 'telat_toleransi')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .gt('telat_menit', 0)
        .order('telat_menit', { ascending: false })
        .limit(30),
      sb
        .from('stok_waste_reports')
        .select('id, qty, reason, status, created_at, outlet_id, bahan_baku_id, outlets(name), bahan_baku(nama, satuan)')
        .gte('created_at', start30)
        .order('created_at', { ascending: false })
        .limit(600),
      sb
        .from('orders')
        .select('id, total_amount, created_at, outlet_id, outlets(name)')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .eq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(100),
      sb
        .from('shifts')
        .select('id, outlet_id, status, start_time, end_time, variance, petty_cash_variance, outlets(name)')
        .gte('start_time', startToday)
        .lt('start_time', endToday)
        .order('start_time', { ascending: true })
        .limit(100),
      sb
        .from('bahan_baku_harga')
        .select('bahan_baku_id, harga_beli, harga_updated_at')
        .order('harga_updated_at', { ascending: false })
        .limit(200),
      sb
        .from('petty_cash_expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglStr)
        .is('deleted_at', null)
        .order('amount', { ascending: false })
        .limit(100),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .eq('expense_date', tglStr)
        .order('amount', { ascending: false })
        .limit(100),
      sb
        .from('expenses')
        .select('id, category, amount, description, expense_date, outlet_id, outlets(name)')
        .gte('expense_date', `${tglStr.slice(0, 7)}-01`)
        .order('amount', { ascending: false })
        .limit(10),
      sb
        .rpc('get_purchase_orders', { p_from: `${tglStr.slice(0, 4)}-01-01`, p_to: tglStr, p_status: null })
        .then((r: any) => r, () => ({ data: [] })),
      sb
        .from('cash_transaction')
        .select('id, amount, category, occurred_at, sales_date, status, outlets(name)')
        .eq('source_type', 'cash_deposit')
        .in('status', ['reconciled', 'paid', 'approved', 'pending_approval'])
        .order('occurred_at', { ascending: false })
        .limit(10),
      sb
        .from('shifts')
        .select('id, outlet_id, status, start_time, end_time, variance, expected_ending_cash, actual_ending_cash, staff:outlet_staff!shifts_staff_id_fkey(name), outlets(name)')
        .eq('status', 'closed')
        .neq('variance', 0)
        .order('start_time', { ascending: false })
        .limit(10),
    ])

    const rawOutlets = (resOutlets.data || []).filter((o: any) =>
      adalahOutletPenjualan(o.name, o.type, o.code)
    )
    const validOutletIds = new Set(rawOutlets.map((o: any) => o.id))

    const isOutletCabang = (a: any) => {
      if (a.outlet_id && validOutletIds.has(a.outlet_id)) return true
      const outName = a.outlets?.name || ''
      const outType = a.outlets?.type || ''
      const outCode = a.outlets?.code || ''
      return adalahOutletPenjualan(outName, outType, outCode)
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

    // Top Menu
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

    // Kehadiran / HRD Kru Outlet (hanya clock-in di cabang operasional, abaikan telat_toleransi)
    const att = (resAtt.data || []).filter(isOutletCabang)
    const kehadiranTotal = att.length
    const kehadiranTelat = att.filter(
      (a: any) =>
        a.status !== 'telat_toleransi' &&
        (a.status === 'telat' || a.status === 'terlambat' || Number(a.telat_menit) > 0)
    ).length
    const kehadiranTepatWaktu = kehadiranTotal - kehadiranTelat
    const persenOnTime = kehadiranTotal > 0 ? Math.round((kehadiranTepatWaktu / kehadiranTotal) * 100) : 100

    const totalOutletAktif = rawOutlets.length
    const bahanBaku = (resBahan.data || []).map((b: any) => ({ nama: b.nama, satuan: b.satuan }))

    // Staf Cuti / Izin (khusus kru operasional outlet)
    const stafCutiIzin: StafCutiTelemetri[] = (resLeave.data || [])
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

    // Staf Telat Kru Outlet
    const lateFiltered = (resLate.data || []).filter(isOutletCabang)
    const staffIds = lateFiltered.map((a: any) => a.outlet_staff_id).filter(Boolean)
    const { data: staffList } = staffIds.length > 0
      ? await sb.from('outlet_staff').select('id, name, role').in('id', staffIds)
      : { data: [] }
    const staffMap: Record<string, { name: string; role: string }> = {}
    for (const s of (staffList || []) as any[]) {
      staffMap[s.id] = { name: s.name, role: s.role }
    }

    const stafTelat: StafTelatTelemetri[] = lateFiltered
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
    const bahanMap: Record<string, { nama: string; satuan: string; totalQty: number; frekuensi: number; reasons: Record<string, number>; estKerugianRp: number }> = {}
    const outletWasteMap: Record<string, { nama: string; frekuensi: number; totalQty: number }> = {}

    for (const r of wasteRows) {
      const isToday = r.created_at && r.created_at.startsWith(tglStr)
      if (isToday) laporanHariIniCount++

      const bNama = r.bahan_baku?.nama || 'Bahan Baku'
      const sat = r.bahan_baku?.satuan || 'unit'
      const qty = Number(r.qty) || 0
      const hBeli = priceMap[r.bahan_baku_id] || 0
      const estLoss = Math.round(qty * hBeli)
      totalEstKerugianRp += estLoss

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
    }

    // ─────────────────────────────────────────────────────────── Void & Pembatalan Transaksi POS
    const voidRows = (resVoid?.data || []) as any[]
    let totalNilaiVoidHariIni = 0
    const daftarOutletVoidHariIni = voidRows.map((v) => {
      const amt = Number(v.total_amount) || 0
      totalNilaiVoidHariIni += amt
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

    const voidOrder: VoidOrderTelemetri = {
      totalVoidHariIni: voidRows.length,
      totalNilaiVoidHariIni,
      daftarOutletVoidHariIni,
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

    const statusBuka: StatusBukaTelemetri = {
      totalBuka: daftarBuka.length,
      totalBelumBuka: daftarBelumBuka.length,
      daftarBuka,
      daftarBelumBuka,
    }

    // ─────────────────────────────────────────────────────────── Telemetri Finance
    const rawPetty = (resPettyHariIni?.data || []) as any[]
    const rawExp = (resExpHariIni?.data || []) as any[]
    const rawExpBulan = (resExpBulanIni?.data || []) as any[]
    const rawPo = (resPo?.data || []) as any[]
    const rawSetoran = (resSetoran?.data || []) as any[]
    const rawSelisih = (resSelisih?.data || []) as any[]

    const itemsHariIni: FinanceItemPengeluaran[] = [
      ...rawPetty.map((r: any) => ({
        id: r.id,
        nominal: Number(r.amount) || 0,
        deskripsi: r.description || 'Pengeluaran kas kecil',
        kategori: r.category || 'petty_cash',
        outlet: r.outlets?.name || 'Cabang',
        tipe: 'petty_cash' as const,
        tanggal: r.expense_date || tglStr,
      })),
      ...rawExp.map((r: any) => ({
        id: r.id,
        nominal: Number(r.amount) || 0,
        deskripsi: r.description || 'Operasional outlet',
        kategori: r.category || 'operasional',
        outlet: r.outlets?.name || 'Pusat',
        tipe: 'operasional' as const,
        tanggal: r.expense_date || tglStr,
      })),
    ].sort((a, b) => b.nominal - a.nominal)

    const totalNominalHariIni = itemsHariIni.reduce((sum, item) => sum + item.nominal, 0)

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

    const finance: FinanceTelemetri = {
      pengeluaranHariIni: {
        totalNominal: totalNominalHariIni,
        jumlahTransaksi: itemsHariIni.length,
        topPengeluaran: itemsHariIni.slice(0, 10),
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
      },
      selisihKasir: {
        daftarSelisihTerbaru,
      },
    }

    return {
      tanggalWIB: tglStr,
      omzetTotal: ringkasanHariIni.omzetTotal,
      totalOrder: ringkasanHariIni.totalOrder,
      aov: ringkasanHariIni.aov,
      outlets: ringkasanHariIni.outletsAktifTransaksi.concat(ringkasanHariIni.outletsNolTransaksi),
      outletsAktifTransaksi: ringkasanHariIni.outletsAktifTransaksi,
      outletsNolTransaksi: ringkasanHariIni.outletsNolTransaksi,
      topMenu: sortedMenu,
      kehadiranTotal,
      kehadiranTepatWaktu,
      kehadiranTelat,
      persenOnTime,
      totalOutletAktif,
      bahanBaku,
      stafCutiIzin,
      stafTelat,
      waste,
      voidOrder,
      statusBuka,
      ringkasanHariIni,
      ringkasanKemarin,
      finance,
    }
  } catch (err) {
    console.error('[telemetriNyata] gagal ambil telemetri:', err)
    return null
  }
}
