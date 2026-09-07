import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  const { id } = await params
  const retail = createRetailClient()

  // Selalu dibatasi ke customer_id dari token. Tanpa ini, siapa pun yang
  // menebak id pesanan bisa membaca pesanan orang lain.
  const { data: draft } = await retail
    .from('order_drafts')
    .select('id, status, total_amount, outlet_id, pos_order_id, pos_order_number, created_at, expires_at, payment_url, qr_string')
    .eq('id', id)
    .eq('customer_id', sesi.customerId)
    .maybeSingle()

  if (!draft) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 })
  }

  const db = createServiceClient()
  const { data: outlet } = await db
    .from('outlets')
    .select('name')
    .eq('id', draft.outlet_id)
    .maybeSingle()

  let statusDapur: string | null = null
  if (draft.pos_order_id) {
    const { data: pos } = await db
      .from('orders')
      .select('status')
      .eq('id', draft.pos_order_id)
      .maybeSingle()
    statusDapur = pos?.status ?? null
  }

  return NextResponse.json({
    id: draft.id,
    status: draft.status,
    status_dapur: statusDapur,
    total_amount: draft.total_amount,
    pos_order_number: draft.pos_order_number,
    outlet_name: outlet?.name ?? null,
    created_at: draft.created_at,
    // Aplikasi butuh ini untuk tahu apakah percobaan pembayaran yang
    // tertinggal masih hidup. Tanpanya, aplikasi memantau draft yang sudah
    // lewat batas waktu dan tidak akan pernah berubah status -- pelanggan
    // menonton pemuat selama lima menit lalu diberi pesan yang keliru.
    expires_at: draft.expires_at,
    // Supaya pelanggan bisa MEMBUKA LAGI halaman pembayaran percobaan yang
    // masih hidup. Tanpa ini ia terjebak: tagihan lama masih berlaku, pesanan
    // kedua ditolak demi mencegah tagihan ganda, dan tidak ada jalan ke
    // halaman bayarnya. Salinan lokal di aplikasi hilang begitu aplikasi
    // dipasang ulang atau pelanggan ganti perangkat -- server yang tahu.
    payment_url: draft.payment_url,
    // Aplikasi menggambar sendiri kodenya. Dikirim juga di sini supaya
    // percobaan yang dilanjutkan (aplikasi sempat mati, atau pelanggan ganti
    // perangkat) tetap bisa menampilkan QR yang sama -- bukan membuat tagihan
    // kedua.
    qr_string: draft.qr_string,
  })
}
