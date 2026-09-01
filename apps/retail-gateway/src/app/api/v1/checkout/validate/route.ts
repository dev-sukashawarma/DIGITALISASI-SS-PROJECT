import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { hitungTotal, type ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const DISKON_PILOT_PERSEN = 0

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { outlet_id?: string; items?: ItemPesanan[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.outlet_id || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'outlet_id dan items wajib diisi' }, { status: 400 })
  }

  if (!jumlahWajar(body.items)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: outlet } = await db
    .from('outlets')
    .select('id, name, app_enabled, is_active')
    .eq('id', body.outlet_id)
    .maybeSingle()

  if (!outlet || outlet.app_enabled !== true) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tidak_melayani', pesan: 'Outlet ini belum melayani pesanan aplikasi' },
      { status: 200 }
    )
  }

  if (outlet.is_active === false) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tutup', pesan: 'Outlet sedang tutup' },
      { status: 200 }
    )
  }

  // Ketersediaan & harga SELALU dibaca segar di titik ini, tidak dari cache.
  // `true` hanya melewati cache outlet ini -- jangan buang cache outlet lain.
  const katalog = await ambilKatalog(body.outlet_id, true)
  const masalah = periksaKeranjang(body.items, katalog)

  if (masalah.length > 0) {
    return NextResponse.json({ ok: false, alasan: 'keranjang_berubah', masalah }, { status: 200 })
  }

  const rincian = hitungTotal(body.items, DISKON_PILOT_PERSEN)
  return NextResponse.json({ ok: true, ...rincian })
}
