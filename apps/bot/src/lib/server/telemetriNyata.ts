import { createClient } from '@supabase/supabase-js'

export interface OutletTelemetri {
  id: string
  nama: string
  type: string
  omzet: number
  orderCount: number
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
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://khpkoreaaucvyqfhynfq.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return createClient(url, key, { auth: { persistSession: false } })
}

export function formatRupiah(angka: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka)
}

export async function ambilTelemetriNyata(): Promise<TelemetriHariIni | null> {
  try {
    const sb = getSupabaseAdmin()
    const d = new Date()
    const offset = 7 * 60
    const wib = new Date(Date.now() + (offset + d.getTimezoneOffset()) * 60000)
    const tglStr = wib.toISOString().slice(0, 10)
    const startToday = `${tglStr}T00:00:00+07:00`

    const [resOrders, resItems, resAtt, resOutlets, resBahan] = await Promise.all([
      sb
        .from('orders')
        .select('id, total_amount, status, outlet_id, outlets(name)')
        .gte('created_at', startToday)
        .neq('status', 'cancelled'),
      sb
        .from('order_items')
        .select('id, quantity, menu_item_name, subtotal, orders!inner(created_at, status)')
        .gte('orders.created_at', startToday)
        .neq('orders.status', 'cancelled'),
      sb
        .from('attendance')
        .select('id, outlet_staff_id, status, telat_menit, type')
        .gte('created_at', startToday),
      sb
        .from('outlets')
        .select('id, name, type, is_active')
        .eq('is_active', true)
        .order('name'),
      sb
        .from('bahan_baku')
        .select('id, nama, satuan')
        .eq('is_active', true)
        .limit(12),
    ])

    const orders = resOrders.data || []
    const totalOrder = orders.length
    const omzetTotal = orders.reduce((acc, o: any) => acc + (Number(o.total_amount) || 0), 0)
    const aov = totalOrder > 0 ? Math.round(omzetTotal / totalOrder) : 0

    // Outlet Breakdown - Gabungkan seluruh outlet aktif dengan data transaksi hari ini
    const mapOmzet: Record<string, number> = {}
    const mapCount: Record<string, number> = {}
    for (const o of orders as any[]) {
      const id = o.outlet_id
      mapOmzet[id] = (mapOmzet[id] || 0) + (Number(o.total_amount) || 0)
      mapCount[id] = (mapCount[id] || 0) + 1
    }

    const allOutlets: OutletTelemetri[] = (resOutlets.data || []).map((o: any) => ({
      id: o.id,
      nama: o.name,
      type: o.type || 'internal',
      omzet: mapOmzet[o.id] || 0,
      orderCount: mapCount[o.id] || 0,
    })).sort((a, b) => b.omzet - a.omzet)

    const outletsAktifTransaksi = allOutlets.filter((o) => o.orderCount > 0)
    const outletsNolTransaksi = allOutlets.filter((o) => o.orderCount === 0)

    // Top Menu
    const items = resItems.data || []
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

    const totalOutletAktif = allOutlets.length
    const bahanBaku = (resBahan.data || []).map((b: any) => ({ nama: b.nama, satuan: b.satuan }))

    return {
      tanggalWIB: tglStr,
      omzetTotal,
      totalOrder,
      aov,
      outlets: allOutlets,
      outletsAktifTransaksi,
      outletsNolTransaksi,
      topMenu: sortedMenu,
      kehadiranTotal,
      kehadiranTepatWaktu,
      kehadiranTelat,
      persenOnTime,
      totalOutletAktif,
      bahanBaku,
    }
  } catch (err) {
    console.error('[telemetriNyata] gagal ambil telemetri:', err)
    return null
  }
}
