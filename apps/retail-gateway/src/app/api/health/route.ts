import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Penanda versi yang sedang berjalan.
 *
 * `SOURCE_COMMIT` diisi Coolify saat build dan di-`ENV` ulang di stage runner
 * (lihat Dockerfile -- Docker tidak membawa ARG/ENV lintas stage).
 *
 * Tanpa penanda ini, satu-satunya cara mengetahui versi mana yang hidup
 * adalah menyimpulkannya dari perilaku -- dan itu sudah tiga kali menyesatkan
 * di proyek ini: redeploy tampak berhasil padahal yang terbangun kode lama,
 * lalu waktu habis mengejar bug yang sebenarnya sudah diperbaiki.
 *
 * `"tidak diketahui"` berarti variabelnya belum di-set di panel Coolify,
 * BUKAN berarti build-nya bermasalah.
 */
function versiBuild(): string {
  const c = process.env.SOURCE_COMMIT?.trim()
  if (!c) return 'tidak diketahui'
  // Tujuh karakter cukup untuk dicocokkan dengan `git log --oneline`;
  // commit penuh terlalu panjang untuk dibaca sekilas.
  return c.slice(0, 7)
}

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'retail-gateway',
    commit: versiBuild(),
  })
}
