import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import sharp from 'sharp'

// Foto selfie absensi disimpan dari kamera kru (kiosk / native HP).
//
// Agar TIDAK memicu kuota berbayar "Storage Image Transformations" di Supabase:
// 1. size="full" (saat klik modal detail): redirect ke Signed URL standar TANPA parameter transform.
// 2. size="thumb" (ratusan thumbnail di tabel rekap): di-download dan di-resize lokal via sharp
//    ke thumbnail 96x96 px (~2 KB), disimpan di memori sementara (LRU cache) + HTTP cache header.
//
// Tetap memakai sesi user (RLS storage tetap ditegakkan).

const TTL = 60 * 60

// Memory cache untuk thumbnail agar server tidak resize ulang berkali-kali (~2 KB x 300 item < 1 MB RAM)
const thumbCache = new Map<string, { buffer: Buffer; timestamp: number }>()
const MAX_CACHE_ITEMS = 300
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 jam

function getCachedThumb(path: string): Buffer | null {
  const item = thumbCache.get(path)
  if (!item) return null
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    thumbCache.delete(path)
    return null
  }
  return item.buffer
}

function setCachedThumb(path: string, buffer: Buffer) {
  if (thumbCache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = thumbCache.keys().next().value
    if (oldestKey) thumbCache.delete(oldestKey)
  }
  thumbCache.set(path, { buffer, timestamp: Date.now() })
}

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

  // Mode 'full': modal detail foto, gunakan Signed URL standar tanpa opsi transform (0 kuota Supabase transform)
  if (size === 'full') {
    const { data, error } = await supabase.storage
      .from('selfies')
      .createSignedUrl(path, TTL)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'Foto tidak tersedia.' }, { status: 404 })
    }

    const res = NextResponse.redirect(data.signedUrl, { status: 307 })
    res.headers.set('Cache-Control', `private, max-age=${TTL - 300}`)
    return res
  }

  // Mode 'thumb': cek in-memory cache dulu
  const cached = getCachedThumb(path)
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      },
    })
  }

  // Download dari Supabase Storage (hanya storage download biasa, bukan transform)
  const { data: blob, error } = await supabase.storage.from('selfies').download(path)
  if (error || !blob) {
    return NextResponse.json({ error: error?.message ?? 'Foto tidak tersedia.' }, { status: 404 })
  }

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Resize via sharp lokal: auto-rotate EXIF, resize 96x96, JPEG quality 65
    const thumbBuffer = await sharp(inputBuffer, { limitInputPixels: 40_000_000, sequentialRead: true })
      .rotate()
      .resize({ width: 96, height: 96, fit: 'cover' })
      .jpeg({ quality: 65 })
      .toBuffer()

    setCachedThumb(path, thumbBuffer)

    return new NextResponse(new Uint8Array(thumbBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      },
    })
  } catch (err) {
    console.error('[selfie-thumb] Gagal resize foto dengan sharp:', err)
    return NextResponse.json({ error: 'Gagal memproses thumbnail foto.' }, { status: 500 })
  }
}
