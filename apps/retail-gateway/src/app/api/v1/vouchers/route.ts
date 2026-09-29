import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/auth'
import { createRetailClient, createServiceClient } from '@/lib/supabase'
import { ambilKatalog } from '@/lib/catalog'
import { KOLOM_VOUCHER, normalisasiVoucher, konteksPelanggan, pelangganSudahPernahBayar } from '@/lib/voucherDb'
import { terapkanVoucher, kalimatSyarat, labelNilai } from '@/lib/voucher'
import type { ItemPesanan } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

/**
 * Daftar voucher PUBLIK untuk halaman Voucher dan pemilih di checkout.
 * Voucher rahasia (ber-kode) tidak pernah ikut di sini.
 */
export async function POST(request: Request) {
  const sesi = await requireCustomer(request)
  if (!sesi) return NextResponse.json({ error: 'Sesi tidak sah' }, { status: 401 })

  let body: { outlet_id?: string; items?: ItemPesanan[] } = {}
  try {
    const teks = await request.text()
    if (teks) body = JSON.parse(teks)
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }
  const pakaiKeranjang = !!body.outlet_id && Array.isArray(body.items) && body.items.length > 0

  try {
    const retail = createRetailClient()
    const sekarangIso = new Date().toISOString()
    const { data, error } = await retail
      .from('vouchers')
      .select(KOLOM_VOUCHER + ', created_at')
      .is('kode', null)
      .eq('is_active', true)
      .or(`selesai.is.null,selesai.gt.${sekarangIso}`)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    const vouchers = (data ?? []).map((b) => normalisasiVoucher(b as unknown as Record<string, unknown>))
    // Daftar ini hanya TAMPILAN (status "berlaku/belum"). Harga & voucher
    // dihitung ulang dengan katalog segar di checkout/validate dan POST
    // /orders, jadi di sini cukup katalog ber-cache 5 menit -- memaksa segar
    // di sini membuat tiap buka halaman Voucher membaca ulang menu outlet.
    // `pelangganSudahPernahBayar` tidak bergantung pada voucher, jadi dihitung
    // sekali per permintaan (bukan sekali per voucher), dan hanya bila ada voucher.
    const [katalog, sudahBayar] = await Promise.all([
      pakaiKeranjang ? ambilKatalog(body.outlet_id!) : Promise.resolve(null),
      vouchers.length > 0 ? pelangganSudahPernahBayar(retail, sesi.customerId) : Promise.resolve(false),
    ])

    const idMenu = [...new Set(vouchers.map((v) => v.menu_item_id).filter((x): x is string => !!x))]
    const namaMenu: Record<string, string> = {}
    if (idMenu.length > 0) {
      const { data: menu, error: eMenu } = await createServiceClient().from('menu_items').select('id, name').in('id', idMenu)
      if (eMenu) throw new Error(eMenu.message)
      for (const m of menu ?? []) namaMenu[m.id as string] = m.name as string
    }

    const sekarang = new Date()
    const hasil = await Promise.all(vouchers.map(async (v) => {
      const kp = await konteksPelanggan(retail, v.id, sesi.customerId, sudahBayar)
      const h = terapkanVoucher(v, pakaiKeranjang ? body.items! : null, {
        outletId: pakaiKeranjang ? body.outlet_id! : null, sekarang, katalog, ...kp,
      })
      const label = labelNilai(v, namaMenu)
      return {
        id: v.id, nama: v.nama, deskripsi: v.deskripsi, jenis: v.jenis,
        kalimat_syarat: kalimatSyarat(v, namaMenu), selesai: v.selesai,
        label_nilai: label.nilai, label_sub: label.sub,
        status: h.berlaku ? 'berlaku' : 'belum',
        ...(h.berlaku ? {} : { alasan: h.alasan }),
      }
    }))
    // Urutan stabil: berlaku dulu, sisanya mempertahankan urutan terbaru.
    hasil.sort((a, b) => Number(b.status === 'berlaku') - Number(a.status === 'berlaku'))
    return NextResponse.json({ vouchers: hasil })
  } catch (e) {
    console.error('gagal memuat voucher', e)
    return NextResponse.json({ error: 'Gagal memuat voucher' }, { status: 502 })
  }
}
