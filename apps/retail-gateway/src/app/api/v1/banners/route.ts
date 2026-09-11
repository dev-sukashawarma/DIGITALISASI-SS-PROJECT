import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { petakanBanner, pilihPopup, type BannerApp } from '@/lib/banners'

export const dynamic = 'force-dynamic'

// Sengaja TANPA cache. Katalog di-cache 5 menit karena besar dan sering
// dibaca; banner kecil dan dibaca sekali per buka Beranda. Cache di sini
// hanya menciptakan pertanyaan "kenapa perubahan saya belum muncul".

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_banners')
    .select('id, slot, urutan, badge, judul, subjudul, teks_tombol, gambar_url, aksi, target_menu_item_id')
    .eq('aktif', true)
    .order('urutan', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat banner' }, { status: 502 })
  }

  const baris = data ?? []
  const carousel: BannerApp[] = []
  const popupKandidat: BannerApp[] = []

  for (const b of baris) {
    const dipetakan = petakanBanner(b)
    if (!dipetakan) continue
    if ((b as { slot?: unknown }).slot === 'popup') popupKandidat.push(dipetakan)
    else carousel.push(dipetakan)
  }

  return NextResponse.json({ carousel, popup: pilihPopup(popupKandidat) })
}
