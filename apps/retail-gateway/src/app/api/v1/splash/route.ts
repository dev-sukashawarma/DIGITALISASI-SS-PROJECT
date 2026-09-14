import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { petakanSplash } from '@/lib/splash'

export const dynamic = 'force-dynamic'

// Tanpa cache, alasan sama dengan /v1/banners: kecil, dan cache hanya
// menciptakan pertanyaan "kenapa perubahan saya belum muncul".
//
// Galat basis data WAJIB dibalas sebagai galat (502), BUKAN sebagai pengaturan
// bawaan. `gambar_url: null` berarti "admin memilih gambar bawaan", dan
// aplikasi akan membuang gambar yang sudah tersimpan. Menjawab galat dengan
// null membuat gangguan server sesaat mengganti splash semua pelanggan.
// Aplikasi mengabaikan balasan gagal dan tetap memakai simpanannya.

export async function GET() {
  const db = createServiceClient()
  const { data, error } = await db
    .from('app_splash_setting')
    .select('gambar_url, durasi_ms')
    .eq('id', true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Gagal memuat splash' }, { status: 502 })
  }
  return NextResponse.json(petakanSplash(data))
}
