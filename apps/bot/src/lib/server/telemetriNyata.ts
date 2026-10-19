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

export interface RingkasanHari {
  tanggalLabel: string
  tglIso: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outletsAktifTransaksi: OutletTelemetri[]
  outletsNolTransaksi: OutletTelemetri[]
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
  ringkasanHariIni?: RingkasanHari
  ringkasanKemarin?: RingkasanHari
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

export function formatRupiah(angka: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka)
}

function hitungRingkasan(
  ordersData: any[],
  baseOutlets: any[],
  tglLabel: string,
  tglIso: string
): RingkasanHari {
  const mapOmzet: Record<string, number> = {}
  const mapCount: Record<string, number> = {}
  let omzetTotal = 0
  for (const o of ordersData) {
    const id = o.outlet_id
    const amt = Number(o.total_amount) || 0
    mapOmzet[id] = (mapOmzet[id] || 0) + amt
    mapCount[id] = (mapCount[id] || 0) + 1
    omzetTotal += amt
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
  const totalOrder = ordersData.length
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
    const d = new Date()
    const offset = 7 * 60
    const wib = new Date(Date.now() + (offset + d.getTimezoneOffset()) * 60000)
    const tglStr = wib.toISOString().slice(0, 10)
    const wibBesok = new Date(wib.getTime() + 24 * 60 * 60 * 1000)
    const tglBesokStr = wibBesok.toISOString().slice(0, 10)
    const wibKemarin = new Date(wib.getTime() - 24 * 60 * 60 * 1000)
    const tglKemarinStr = wibKemarin.toISOString().slice(0, 10)

    const startKemarin = `${tglKemarinStr}T00:00:00+07:00`
    const endKemarin = `${tglStr}T00:00:00+07:00`
    const startToday = `${tglStr}T00:00:00+07:00`
    const endToday = `${tglBesokStr}T00:00:00+07:00`

    const [ordersHariIni, ordersKemarin, items, resAtt, resOutlets, resBahan, resLeave, resLate] = await Promise.all([
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, status, outlet_id, outlets(name)')
          .gte('created_at', startToday)
          .lt('created_at', endToday)
          .neq('status', 'cancelled')
      ),
      fetchAllRows(sb, 'orders', (q) =>
        q
          .select('id, total_amount, status, outlet_id, outlets(name)')
          .gte('created_at', startKemarin)
          .lt('created_at', endKemarin)
          .neq('status', 'cancelled')
      ),
      fetchAllRows(sb, 'order_items', (q) =>
        q
          .select('id, quantity, menu_item_name, subtotal, orders!inner(created_at, status)')
          .gte('orders.created_at', startToday)
          .lt('orders.created_at', endToday)
          .neq('orders.status', 'cancelled')
      ),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .limit(2000),
      sb
        .from('outlets')
        .select('id, name, type, is_active')
        .eq('is_active', true)
        .order('name'),
      sb
        .from('bahan_baku')
        .select('id, nama, satuan')
        .eq('is_active', true)
        .limit(20),
      sb
        .from('leave_requests')
        .select('id, leave_type, status, reason, outlet_staff:staff_id(name, role)')
        .lte('start_date', tglStr)
        .gte('end_date', tglStr)
        .in('status', ['approved', 'pending'])
        .limit(50),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, telat_menit, outlets(name)')
        .gte('created_at', startToday)
        .lt('created_at', endToday)
        .gt('telat_menit', 0)
        .order('telat_menit', { ascending: false })
        .limit(15),
    ])

    const rawOutlets = resOutlets.data || []

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

    // Kehadiran / HRD
    const att = resAtt.data || []
    const kehadiranTotal = att.length
    const kehadiranTelat = att.filter((a: any) => Number(a.telat_menit) > 0).length
    const kehadiranTepatWaktu = kehadiranTotal - kehadiranTelat
    const persenOnTime = kehadiranTotal > 0 ? Math.round((kehadiranTepatWaktu / kehadiranTotal) * 100) : 100

    const totalOutletAktif = rawOutlets.length
    const bahanBaku = (resBahan.data || []).map((b: any) => ({ nama: b.nama, satuan: b.satuan }))

    // Staf Cuti / Izin
    const stafCutiIzin: StafCutiTelemetri[] = (resLeave.data || []).map((l: any) => ({
      nama: l.outlet_staff?.name || 'Kru',
      role: l.outlet_staff?.role || 'Staff',
      jenis: l.leave_type || 'Cuti',
      status: l.status || 'pending',
      alasan: l.reason || '-',
    }))

    // Staf Telat dengan Nama
    const staffIds = (resLate.data || []).map((a: any) => a.outlet_staff_id).filter(Boolean)
    const { data: staffList } = staffIds.length > 0
      ? await sb.from('outlet_staff').select('id, name').in('id', staffIds)
      : { data: [] }
    const staffMap: Record<string, string> = {}
    for (const s of (staffList || []) as any[]) {
      staffMap[s.id] = s.name
    }

    const stafTelat: StafTelatTelemetri[] = (resLate.data || []).map((a: any) => ({
      nama: staffMap[a.outlet_staff_id] || 'Kru',
      outlet: a.outlets?.name || 'Cabang',
      telatMenit: Number(a.telat_menit) || 0,
    }))

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
      ringkasanHariIni,
      ringkasanKemarin,
    }
  } catch (err) {
    console.error('[telemetriNyata] gagal ambil telemetri:', err)
    return null
  }
}
