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
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: 'Gagal memuat menu' }, { status: 502 })
  }
}
