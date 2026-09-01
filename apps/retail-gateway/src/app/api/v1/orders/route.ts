import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { hitungTotal, type ItemPesanan } from '@/lib/pricing'
import { buatKodeAmbil } from '@/lib/pickupCode'
import { buatTagihan } from '@/lib/xendit'

export const dynamic = 'force-dynamic'

const DISKON_PILOT_PERSEN = 0
const BATAS_BAYAR_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: {
    client_order_id?: string
    outlet_id?: string
    items?: ItemPesanan[]
    customer_phone?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  if (!body.client_order_id || !body.outlet_id || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'client_order_id, outlet_id, dan items wajib diisi' },
      { status: 400 }
    )
  }

  if (!jumlahWajar(body.items)) {
    return NextResponse.json({ error: 'Jumlah pesanan tidak wajar' }, { status: 400 })
  }

  const retail = createRetailClient()

  // Idempotensi: percobaan kedua untuk client_order_id yang sama
  // mengembalikan draft yang sudah ada, bukan membuat tagihan baru.
  const { data: sudahAda } = await retail
    .from('order_drafts')
    .select('id, pickup_code, payment_url, total_amount, expires_at, status')
    .eq('client_order_id', body.client_order_id)
    .maybeSingle()

  if (sudahAda) {
    return NextResponse.json({
      order_id: sudahAda.id,
      pickup_code: sudahAda.pickup_code,
      payment_url: sudahAda.payment_url,
      total_amount: sudahAda.total_amount,
      expires_at: sudahAda.expires_at,
      duplicate: true,
    })
  }

  const db = createServiceClient()
  const { data: outlet, error: outletError } = await db
    .from('outlets')
    .select('id, name, app_enabled, is_active')
    .eq('id', body.outlet_id)
    .maybeSingle()

  // Kegagalan database TIDAK boleh menyamar jadi "outlet tidak melayani".
  // Ini gerbang terakhir sebelum tagihan: insiden nyata harus terlihat,
  // bukan tersembunyi di balik pesan bisnis yang salah.
  if (outletError) {
    console.error('gagal membaca outlet', outletError)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }

  if (!outlet || outlet.app_enabled !== true || outlet.is_active === false) {
    return NextResponse.json(
      { error: 'Outlet sedang tidak bisa menerima pesanan' },
      { status: 409 }
    )
  }

  // Pemeriksaan terakhir sebelum tagihan dibuat, langsung ke produksi.
  const katalog = await ambilKatalog(body.outlet_id, true)
  const masalah = periksaKeranjang(body.items, katalog)
  if (masalah.length > 0) {
    return NextResponse.json({ error: 'keranjang_berubah', masalah }, { status: 409 })
  }

  const rincian = hitungTotal(body.items, DISKON_PILOT_PERSEN)
  const kodeAmbil = buatKodeAmbil(body.client_order_id)
  const kedaluwarsa = new Date(Date.now() + BATAS_BAYAR_MS)

  const { data: pelanggan } = await retail
    .from('customers')
    .select('name')
    .eq('id', sesi.customerId)
    .maybeSingle()

  let tagihan
  try {
    tagihan = await buatTagihan({
      externalId: body.client_order_id,
      amount: rincian.total,
      description: `Pesanan SukaShawarma di ${outlet.name}`,
      customerName: pelanggan?.name ?? 'Pelanggan',
    })
  } catch (e) {
    console.error('Gagal membuat tagihan Xendit:', e)
    return NextResponse.json({ error: 'Gagal membuat tagihan pembayaran' }, { status: 502 })
  }

  const { data: draft, error: draftError } = await retail
    .from('order_drafts')
    .insert({
      client_order_id: body.client_order_id,
      customer_id: sesi.customerId,
      outlet_id: body.outlet_id,
      items: body.items,
      subtotal: rincian.subtotal,
      discount_amount: rincian.discountAmount,
      total_amount: rincian.total,
      pickup_code: kodeAmbil,
      payment_ref: tagihan.ref,
      payment_url: tagihan.url,
      expires_at: kedaluwarsa.toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (draftError || !draft) {
    // 23505 = dua permintaan berlomba untuk client_order_id yang sama.
    if ((draftError as { code?: string } | null)?.code === '23505') {
      const { data: pemenang } = await retail
        .from('order_drafts')
        .select('id, pickup_code, payment_url, total_amount, expires_at')
        .eq('client_order_id', body.client_order_id)
        .maybeSingle()
      if (pemenang) {
        return NextResponse.json({
          order_id: pemenang.id,
          pickup_code: pemenang.pickup_code,
          payment_url: pemenang.payment_url,
          total_amount: pemenang.total_amount,
          expires_at: pemenang.expires_at,
          duplicate: true,
        })
      }
    }
    console.error('Gagal menyimpan draft pesanan:', draftError)
    return NextResponse.json({ error: 'Gagal menyimpan pesanan' }, { status: 500 })
  }

  if (body.customer_phone) {
    await retail
      .from('customers')
      .update({ phone: body.customer_phone, updated_at: new Date().toISOString() })
      .eq('id', sesi.customerId)
  }

  return NextResponse.json({
    order_id: draft.id,
    pickup_code: kodeAmbil,
    payment_url: tagihan.url,
    total_amount: rincian.total,
    expires_at: kedaluwarsa.toISOString(),
  })
}
