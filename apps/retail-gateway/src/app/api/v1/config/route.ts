import { NextResponse } from 'next/server'
import { ambilPengaturan } from '@/lib/pengaturanApp'

export const dynamic = 'force-dynamic'

/** Publik (tanpa sesi): dibaca aplikasi sebelum login untuk cek versi minimum. */
export async function GET() {
  const p = await ambilPengaturan()
  return NextResponse.json(
    {
      estimasi_siap: p.estimasiSiap,
      wa_cs: p.waCs,
      versi_minimum_android: p.versiMinimumAndroid,
      url_syarat: p.urlSyarat,
      url_privasi: p.urlPrivasi,
      menu_terlaris_ids: p.menuTerlarisIds,
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
