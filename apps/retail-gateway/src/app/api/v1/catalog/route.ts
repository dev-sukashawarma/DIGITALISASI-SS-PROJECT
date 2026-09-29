import { NextResponse } from 'next/server'
import { ambilKatalog } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get('outlet_id')
  if (!outletId) {
    return NextResponse.json({ error: 'outlet_id wajib diisi' }, { status: 400 })
  }

  try {
    const items = await ambilKatalog(outletId)
    // Publik & tak bergantung sesi (hanya outlet_id di URL). Katalog sendiri
    // sudah di-cache 5 menit di memori; ini hanya mengizinkan cache bersama
    // (proxy/CDN) menahan sebentar. Checkout tetap membaca katalog segar.
    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
    )
  } catch {
    return NextResponse.json({ error: 'Gagal memuat menu' }, { status: 502 })
  }
}
