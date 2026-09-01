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

/** Bentuk nomor HP Indonesia yang wajar: 08xxx, 62xxx, atau +62xxx. */
function nomorHpWajar(nomor: string): boolean {
  return /^(\+62|62|0)8\d{7,12}$/.test(nomor.replace(/[\s-]/g, ''))
}

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
    .eq('customer_id', sesi.customerId)
    .maybeSingle()

  if (sudahAda) {
    // `client_order_id` adalah kunci sekali-pakai, BUKAN id keranjang.
    // Draft yang sudah mati tidak boleh dikembalikan sebagai sukses: pelanggan
    // akan menerima tautan bayar yang tidak berlaku dan terkunci selamanya
    // pada id itu. Cron menghanguskan draft tak dibayar tiap 15 menit, jadi
    // ini kejadian rutin, bukan kasus tepi.
    if (sudahAda.status === 'kadaluarsa' || sudahAda.status === 'gagal') {
      return NextResponse.json(
        {
          error: 'pesanan_kadaluarsa',
          pesan: 'Pesanan sebelumnya sudah kedaluwarsa. Silakan buat pesanan baru.',
        },
        { status: 409 }
      )
    }

    // Draft hidup tapi tagihannya belum tercatat: proses mati di tengah, atau
    // permintaan kembar yang pemenangnya belum selesai membuat tagihan.
    if (!sudahAda.payment_url) {
      return NextResponse.json(
        {
          error: 'pesanan_sedang_diproses',
          pesan: 'Pesanan sedang diproses, coba lagi sebentar.',
        },
        { status: 409 }
      )
    }

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
  let katalog
  try {
    katalog = await ambilKatalog(body.outlet_id, true)
  } catch (e) {
    console.error('gagal memuat katalog segar', e)
    return NextResponse.json({ error: 'Gagal memeriksa menu' }, { status: 502 })
  }
  const masalah = periksaKeranjang(body.items, katalog)
  if (masalah.length > 0) {
    return NextResponse.json({ error: 'keranjang_berubah', masalah }, { status: 409 })
  }

  // Nama item diambil dari KATALOG, bukan dari klien. `periksaKeranjang`
  // hanya mencocokkan id, ketersediaan, dan harga — nama tidak pernah
  // dibandingkan. Nama dari klien berakhir di `nama|NOTE|catatan` yang dibaca
  // struk dapur, jadi nama karangan (atau yang memuat `|NOTE|` sendiri) bisa
  // merusak cetakan dapur.
  const petaMenu = new Map(katalog.map((m) => [m.id, m]))
  const itemsTepercaya: ItemPesanan[] = body.items.map((it) => ({
    menu_item_id: it.menu_item_id,
    name: petaMenu.get(it.menu_item_id)?.name ?? it.name,
    unit_price: it.unit_price,
    quantity: it.quantity,
    note: it.note ? String(it.note).slice(0, 200).replace(/\|NOTE\|/g, ' ') : undefined,
  }))

  const rincian = hitungTotal(itemsTepercaya, DISKON_PILOT_PERSEN)
  const kodeAmbil = buatKodeAmbil(body.client_order_id)
  const kedaluwarsa = new Date(Date.now() + BATAS_BAYAR_MS)

  // URUTAN INI PENTING. Draft dipesan LEBIH DULU, sebelum tagihan dibuat.
  // Kendala unik pada `client_order_id` adalah satu-satunya penjaga yang
  // benar-benar atomik. Kalau tagihan dibuat duluan, dua permintaan yang
  // benar-benar bersamaan menghasilkan DUA tagihan Xendit sebelum kendala itu
  // sempat menangkapnya -- dan pelanggan yang tertagih dua kali adalah
  // kegagalan yang paling merusak kepercayaan.
  const { data: draft, error: draftError } = await retail
    .from('order_drafts')
    .insert({
      client_order_id: body.client_order_id,
      customer_id: sesi.customerId,
      outlet_id: body.outlet_id,
      items: itemsTepercaya,
      subtotal: rincian.subtotal,
      discount_amount: rincian.discountAmount,
      total_amount: rincian.total,
      pickup_code: kodeAmbil,
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

      // Pemenang mungkin belum selesai membuat tagihannya. Jangan kembalikan
      // payment_url kosong -- suruh aplikasi mencoba lagi sebentar lagi.
      if (pemenang && !pemenang.payment_url) {
        // Bentuk balasan SAMA dengan jalur pemeriksaan awal. Aplikasi Android
        // mencocokkan kode mesin `error`, bukan kalimatnya.
        return NextResponse.json(
          {
            error: 'pesanan_sedang_diproses',
            pesan: 'Pesanan sedang diproses, coba lagi sebentar.',
          },
          { status: 409 }
        )
      }

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
    // Draft sudah terlanjur ada. Tandai gagal supaya tidak menggantung sebagai
    // `menunggu_bayar` yang tak akan pernah bisa dibayar, dan supaya percobaan
    // ulang dengan client_order_id yang sama tidak tersandung draft mati ini.
    const { error: tandaiGagalError } = await retail
      .from('order_drafts')
      .update({ status: 'gagal' })
      .eq('id', draft.id)
    if (tandaiGagalError) {
      console.error('GAGAL MENANDAI DRAFT GAGAL', {
        client_order_id: body.client_order_id,
        error: tandaiGagalError,
      })
    }
    return NextResponse.json({ error: 'Gagal membuat tagihan pembayaran' }, { status: 502 })
  }

  const { error: updateError } = await retail
    .from('order_drafts')
    .update({ payment_ref: tagihan.ref, payment_url: tagihan.url })
    .eq('id', draft.id)

  // Tagihan sudah ada di Xendit tapi tidak tercatat di draft. Pelanggan tetap
  // menerima tautannya dari balasan ini, tapi percobaan ulang akan melihat
  // draft tanpa payment_url. Harus terlihat, bukan ditelan.
  if (updateError) {
    console.error('GAGAL MENCATAT TAGIHAN KE DRAFT', {
      client_order_id: body.client_order_id,
      payment_ref: tagihan.ref,
      error: updateError,
    })
  }

  // Nomor hanya ditulis bila bentuknya wajar. Tanpa saringan ini, string
  // sembarang dari klien langsung mendarat di profil pelanggan, dan kasir
  // yang menelepon saat pesanan bermasalah menghubungi nomor yang tidak ada.
  if (body.customer_phone && nomorHpWajar(body.customer_phone)) {
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
