import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createServiceClient, createRetailClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { periksaKeranjang, jumlahWajar } from '@/lib/validateCart'
import { type ItemPesanan } from '@/lib/pricing'
import { buatQris, buatTagihan } from '@/lib/xendit'
import { statusUntuk } from '@/lib/statusOutletDb'
import { pesanStatus } from '@/lib/jamBuka'
import { nilaiVoucher, type NilaiVoucher } from '@/lib/voucherDb'
import { rincianDenganVoucher } from '@/lib/rincianVoucher'
import { CATATAN_GRATIS } from '@/lib/voucher'

export const dynamic = 'force-dynamic'

const BATAS_BAYAR_MS = 15 * 60 * 1000

/** Bentuk nomor HP Indonesia yang wajar: 08xxx, 62xxx, atau +62xxx. */
function nomorHpWajar(nomor: string): boolean {
  return /^(\+62|62|0)8\d{7,12}$/.test(nomor.replace(/[\s-]/g, ''))
}

/**
 * Menandai draft gagal ketika tagihan tidak bisa dibuat.
 *
 * Draft sudah terlanjur ada di titik ini. Membiarkannya `menunggu_bayar`
 * berarti ia menggantung selamanya sebagai pesanan yang tak akan pernah bisa
 * dibayar -- dan `client_order_id`-nya ikut terkunci, sehingga percobaan ulang
 * pelanggan tersandung draft mati itu dengan 409.
 */
async function gagalkanDraft(
  retail: ReturnType<typeof createRetailClient>,
  draftId: string,
  clientOrderId: string,
  sebab: unknown
) {
  console.error('Gagal membuat tagihan Xendit:', sebab)
  const { error } = await retail
    .from('order_drafts')
    .update({ status: 'gagal' })
    .eq('id', draftId)
  if (error) {
    console.error('GAGAL MENANDAI DRAFT GAGAL', { client_order_id: clientOrderId, error })
  }
  return NextResponse.json({ error: 'Gagal membuat tagihan pembayaran' }, { status: 502 })
}

export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: {
    client_order_id?: string
    outlet_id?: string
    items?: ItemPesanan[]
    customer_phone?: string
    voucher_id?: string
    kode_voucher?: string
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
    .select('id, payment_url, total_amount, expires_at, status')
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
      payment_url: sudahAda.payment_url,
      total_amount: sudahAda.total_amount,
      expires_at: sudahAda.expires_at,
      duplicate: true,
    })
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
    return NextResponse.json({ error: 'Outlet sedang tidak bisa menerima pesanan' }, { status: 409 })
  }

  // Titik pembuatan tagihan QRIS -- penjaga terakhir. `validate` saja tidak
  // cukup: aplikasi lama atau pelanggan yang membuka menu sejak 21.25 tetap
  // bisa langsung memanggil endpoint ini.
  let status
  try {
    status = await statusUntuk(outlet)
  } catch (e) {
    console.error('gagal menghitung status outlet', e)
    return NextResponse.json({ error: 'Gagal memeriksa outlet' }, { status: 502 })
  }
  if (!status.bisaPesan) {
    return NextResponse.json(
      { error: 'outlet_tutup', alasan: 'outlet_tutup', pesan: pesanStatus(status) },
      { status: 409 },
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
  // Item bercatatan "Gratis voucher" yang datang dari klien dibuang sebelum
  // diperiksa maupun disusun jadi item tepercaya -- hanya server yang boleh
  // menambahkan item gratis.
  const itemsKlien = body.items.filter((it) => it.note !== CATATAN_GRATIS)
  const masalah = periksaKeranjang(itemsKlien, katalog)
  if (masalah.length > 0) {
    return NextResponse.json({ error: 'keranjang_berubah', masalah }, { status: 409 })
  }

  // Nama item diambil dari KATALOG, bukan dari klien. `periksaKeranjang`
  // hanya mencocokkan id, ketersediaan, dan harga — nama tidak pernah
  // dibandingkan. Nama dari klien berakhir di `nama|NOTE|catatan` yang dibaca
  // struk dapur, jadi nama karangan (atau yang memuat `|NOTE|` sendiri) bisa
  // merusak cetakan dapur.
  const petaMenu = new Map(katalog.map((m) => [m.id, m]))
  const itemsTepercaya: ItemPesanan[] = itemsKlien.map((it) => ({
    menu_item_id: it.menu_item_id,
    name: petaMenu.get(it.menu_item_id)?.name ?? it.name,
    unit_price: it.unit_price,
    quantity: it.quantity,
    note: it.note ? String(it.note).slice(0, 200).replace(/\|NOTE\|/g, ' ') : undefined,
  }))

  let nv: NilaiVoucher
  try {
    nv = await nilaiVoucher({
      retail, pilih: { voucherId: body.voucher_id, kodeVoucher: body.kode_voucher },
      customerId: sesi.customerId, outletId: body.outlet_id, items: itemsTepercaya, katalog, sekarang: new Date(),
    })
  } catch (e) {
    console.error('gagal memeriksa voucher', e)
    return NextResponse.json({ error: 'voucher_tidak_berlaku', pesan: 'Voucher tidak dapat dicek, coba lagi' }, { status: 409 })
  }
  // Tidak ada tagihan yang terbit dengan harga yang salah.
  if (nv.ada && !nv.hasil.berlaku) {
    return NextResponse.json({ error: 'voucher_tidak_berlaku', pesan: nv.hasil.alasan }, { status: 409 })
  }
  const { itemsAkhir, rincian } = rincianDenganVoucher(itemsTepercaya, nv)
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
      items: itemsAkhir,
      subtotal: rincian.subtotal,
      discount_amount: rincian.discountAmount,
      total_amount: rincian.total,
      expires_at: kedaluwarsa.toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (draftError || !draft) {
    // 23505 = dua permintaan berlomba untuk client_order_id yang sama.
    if ((draftError as { code?: string } | null)?.code === '23505') {
      const { data: pemenang } = await retail
        .from('order_drafts')
        .select('id, payment_url, total_amount, expires_at')
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

  // Baris pemakaian dicatat SEBELUM tagihan: kalau gagal, tak ada QRIS yang
  // terbit untuk pesanan berdiskon yang tak tercatat pemakaiannya.
  if (nv.ada && nv.hasil.berlaku && nv.voucher) {
    const { error: pakaiError } = await retail.from('voucher_pemakaian').insert({
      voucher_id: nv.voucher.id, draft_id: draft.id, customer_id: sesi.customerId, potongan: nv.hasil.potongan,
    })
    if (pakaiError) return await gagalkanDraft(retail, draft.id, body.client_order_id, pakaiError)
  }

  const { data: pelanggan } = await retail
    .from('customers')
    .select('name')
    .eq('id', sesi.customerId)
    .maybeSingle()

  // QR Code API didahulukan supaya pembayaran tidak meninggalkan aplikasi:
  // `qr_string` digambar sendiri oleh aplikasi, tanpa peramban.
  //
  // Invoice DIPERTAHANKAN sebagai cadangan, bukan sisa yang lupa dibuang.
  // Kalau QR Code API menolak -- kanal belum aktif di akun, atau Xendit
  // sedang bermasalah -- pelanggan tetap bisa membayar lewat halaman Xendit
  // alih-alih menerima galat. Yang paling buruk di titik ini bukan tampilan
  // yang kurang mulus, melainkan pesanan yang tidak bisa dibayar sama sekali.
  let tagihan
  try {
    tagihan = await buatQris({
      externalId: body.client_order_id,
      amount: rincian.total,
    })
  } catch (eQris) {
    console.error('QR Code API gagal, jatuh ke Invoice:', eQris)
    try {
      tagihan = await buatTagihan({
        externalId: body.client_order_id,
        amount: rincian.total,
        description: `Pesanan SukaShawarma di ${outlet.name}`,
        customerName: pelanggan?.name ?? 'Pelanggan',
      })
    } catch (e) {
      return await gagalkanDraft(retail, draft.id, body.client_order_id, e)
    }
  }


  const { error: updateError } = await retail
    .from('order_drafts')
    .update({
      payment_ref: tagihan.ref,
      payment_url: tagihan.url,
      qr_string: tagihan.qrString,
    })
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
    payment_url: tagihan.url,
    qr_string: tagihan.qrString,
    total_amount: rincian.total,
    expires_at: kedaluwarsa.toISOString(),
  })
}
