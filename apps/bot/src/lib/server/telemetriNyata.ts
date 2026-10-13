import { createClient } from '@supabase/supabase-js'

export interface TelemetriHariIni {
  tanggalWIB: string
  omzetTotal: number
  totalOrder: number
  aov: number
  outlets: Array<{ nama: string; omzet: number; orderCount: number }>
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
        .eq('is_active', true),
      sb
        .from('bahan_baku')
        .select('id, nama, satuan')
        .eq('is_active', true)
        .limit(10),
    ])

    const orders = resOrders.data || []
    const totalOrder = orders.length
    const omzetTotal = orders.reduce((acc, o: any) => acc + (Number(o.total_amount) || 0), 0)
    const aov = totalOrder > 0 ? Math.round(omzetTotal / totalOrder) : 0

    // Outlet Breakdown
    const perOutlet: Record<string, { omzet: number; orderCount: number }> = {}
    for (const o of orders as any[]) {
      const nama = o.outlets?.name || 'Cabang Belum Terpetakan'
      if (!perOutlet[nama]) perOutlet[nama] = { omzet: 0, orderCount: 0 }
      perOutlet[nama].omzet += Number(o.total_amount) || 0
      perOutlet[nama].orderCount += 1
    }
    const sortedOutlets = Object.entries(perOutlet)
      .map(([nama, val]) => ({ nama, ...val }))
      .sort((a, b) => b.omzet - a.omzet)

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
      .slice(0, 5)

    // Kehadiran / HRD
    const att = resAtt.data || []
    const kehadiranTotal = att.length
    const kehadiranTelat = att.filter((a: any) => Number(a.telat_menit) > 0).length
    const kehadiranTepatWaktu = kehadiranTotal - kehadiranTelat
    const persenOnTime = kehadiranTotal > 0 ? Math.round((kehadiranTepatWaktu / kehadiranTotal) * 100) : 100

    const totalOutletAktif = resOutlets.data?.length || 0
    const bahanBaku = (resBahan.data || []).map((b: any) => ({ nama: b.nama, satuan: b.satuan }))

    return {
      tanggalWIB: tglStr,
      omzetTotal,
      totalOrder,
      aov,
      outlets: sortedOutlets,
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
