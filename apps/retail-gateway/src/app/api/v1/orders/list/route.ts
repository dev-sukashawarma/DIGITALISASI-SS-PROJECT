import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BATAS = 30

export async function GET(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const retail = createRetailClient()

  // Selalu dibatasi ke pemilik token. Gateway memakai service role yang
  // melewati RLS, jadi tanpa filter ini seluruh riwayat pelanggan lain terbuka.
  const { data: drafts, error } = await retail
    .from('order_drafts')
    .select('id, status, total_amount, outlet_id, pos_order_id, pos_order_number, created_at')
    .eq('customer_id', sesi.customerId)
    .order('created_at', { ascending: false })
    .limit(BATAS)

  if (error) {
    console.error('gagal memuat riwayat pesanan', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat' }, { status: 502 })
  }

  const baris = drafts ?? []
  if (baris.length === 0) return NextResponse.json({ orders: [] })

  const db = createServiceClient()

  const outletIds = Array.from(new Set(baris.map((d) => d.outlet_id)))
  const { data: outlets } = await db
    .from('outlets')
    .select('id, name')
    .in('id', outletIds)
  const namaOutlet = new Map((outlets ?? []).map((o) => [o.id, o.name]))

  // Status dapur hanya ada untuk pesanan yang sudah terdorong ke kasir.
  const posIds = baris
    .map((d) => d.pos_order_id)
    .filter((v): v is string => Boolean(v))

  const statusDapur = new Map<string, string>()
  if (posIds.length > 0) {
    const { data: pos } = await db.from('orders').select('id, status').in('id', posIds)
    for (const p of pos ?? []) statusDapur.set(p.id, p.status)
  }

  return NextResponse.json({
    orders: baris.map((d) => ({
      id: d.id,
      status: d.status,
      status_dapur: d.pos_order_id ? statusDapur.get(d.pos_order_id) ?? null : null,
      total_amount: d.total_amount,
      pos_order_number: d.pos_order_number,
      outlet_name: namaOutlet.get(d.outlet_id) ?? null,
      created_at: d.created_at,
    })),
  })
}
