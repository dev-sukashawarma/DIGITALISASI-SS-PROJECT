import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'

// Foto selfie absensi disimpan mentah dari kamera HP (0,4–5 MB, ~12 MP).
// Route ini menandatangani URL *hasil transform* Supabase (thumbnail ±2 KB,
// atau versi layar ±100 KB) lalu redirect ke sana. Dipanggil per <img> dengan
// loading="lazy", jadi hanya foto yang terlihat yang ditandatangani.
//
// Sengaja memakai sesi user (bukan service role): hak akses ke bucket
// `selfies` tetap diputuskan RLS storage, sama seperti sebelum route ini ada.

const SIZES = {
  thumb: { width: 96, height: 96, resize: 'cover' as const, quality: 60 },
  full: { width: 1080, height: 1080, resize: 'contain' as const, quality: 80 },
}

const TTL = 60 * 60

function validPath(path: string) {
  return path.length > 0
    && path.length <= 512
    && !path.includes('..')
    && /^[\w-]+\/[\w.-]+\.(jpe?g|png|webp)$/i.test(path)
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const path = params.get('path')?.trim() ?? ''
  const size = params.get('size') === 'full' ? 'full' : 'thumb'
  if (!validPath(path)) return NextResponse.json({ error: 'Path foto tidak valid.' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })

  const { data, error } = await supabase.storage
    .from('selfies')
    .createSignedUrl(path, TTL, { transform: SIZES[size] })
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Foto tidak tersedia.' }, { status: 404 })
  }

  const res = NextResponse.redirect(data.signedUrl, { status: 307 })
  // Browser menyimpan redirect ini selama URL bertanda tangan masih berlaku,
  // jadi scroll bolak-balik / ganti filter tidak menandatangani ulang.
  res.headers.set('Cache-Control', `private, max-age=${TTL - 300}`)
  return res
}
