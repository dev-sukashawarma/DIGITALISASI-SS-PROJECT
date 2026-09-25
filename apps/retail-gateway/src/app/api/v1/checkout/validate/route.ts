import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { type ItemPesanan } from '@/lib/pricing'
import { statusUntuk } from '@/lib/statusOutletDb'
import { pesanStatus } from '@/lib/jamBuka'
import { nilaiVoucher, type NilaiVoucher } from '@/lib/voucherDb'
import { rincianDenganVoucher } from '@/lib/rincianVoucher'
import { CATATAN_GRATIS } from '@/lib/voucher'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { outlet_id?: string; items?: ItemPesanan[]; voucher_id?: string; kode_voucher?: string }
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
  const { data: outlet, error: outletError } = await db
    .from('outlets')
    .select('id, name, app_enabled, is_active, open_hour, close_hour')
    .eq('id', body.outlet_id)
    .maybeSingle()

  // Kegagalan database TIDAK boleh menyamar jadi "outlet tidak melayani".
  // Ini gerbang terakhir sebelum tagihan: insiden nyata harus terlihat,
  // bukan tersembunyi di balik pesan bisnis yang salah.
  if (outletError) {
    console.error('gagal membaca outlet', outletError)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }

  if (!outlet || outlet.app_enabled !== true) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tidak_melayani', pesan: 'Outlet ini belum melayani pesanan aplikasi' },
      { status: 200 }
    )
  }

  let status
  try {
    status = await statusUntuk(outlet)
  } catch (e) {
    console.error('gagal menghitung status outlet', e)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }
  if (!status.bisaPesan) {
    return NextResponse.json(
      { ok: false, alasan: 'outlet_tutup', pesan: pesanStatus(status) },
      { status: 200 },
    )
  }

  // Ketersediaan & harga SELALU dibaca segar di titik ini, tidak dari cache.
  // `true` hanya melewati cache outlet ini -- jangan buang cache outlet lain.
  let katalog
  try {
    katalog = await ambilKatalog(body.outlet_id, true)
  } catch (e) {
    console.error('gagal memuat katalog segar', e)
    return NextResponse.json({ error: 'Gagal memeriksa menu' }, { status: 502 })
  }
  const itemsBelanja = body.items.filter((it) => it.note !== CATATAN_GRATIS)
  const masalah = periksaKeranjang(itemsBelanja, katalog)

  if (masalah.length > 0) {
    return NextResponse.json({ ok: false, alasan: 'keranjang_berubah', masalah }, { status: 200 })
  }

  let nv: NilaiVoucher
  try {
    nv = await nilaiVoucher({
      retail: createRetailClient(), pilih: { voucherId: body.voucher_id, kodeVoucher: body.kode_voucher },
      customerId: sesi.customerId, outletId: body.outlet_id, items: itemsBelanja, katalog, sekarang: new Date(),
    })
  } catch (e) {
    console.error('gagal memeriksa voucher', e)
    nv = { ada: true as const, voucher: null, hasil: { berlaku: false as const, alasan: 'Voucher tidak dapat dicek, coba lagi' } }
  }
  const { rincian, blok } = rincianDenganVoucher(itemsBelanja, nv)
  return NextResponse.json({ ok: true, ...rincian, voucher: blok })
}
