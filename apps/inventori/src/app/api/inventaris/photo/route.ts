import { cookies } from 'next/headers'
import { after, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@suka/auth'

export const runtime = 'nodejs'

const PHOTO_BUCKET = 'inventaris-foto'
const MAX_INPUT_FILE_BYTES = 50 * 1024 * 1024
// Hasil kompresi browser (1024px, WebP q72) hampir selalu di bawah 400 KB.
// Ambang ini membedakannya dari WebP besar yang dipilih langsung dari galeri.
const OPTIMIZED_PHOTO_MAX_BYTES = 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function isSafePhotoPath(path: string) {
  return path.length > 0
    && path.length <= 1024
    && !path.includes('..')
    && /^[0-9a-f-]+\//i.test(path)
    && path.toLowerCase().endsWith('.webp')
}

function getAccessibleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids)
    .filter((id): id is string => Boolean(id))
}

async function createServerClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
      })
    },
  })
}

function isOwnedDraftPath(path: string | null, userId: string, outletId: string) {
  return Boolean(path)
    && path!.startsWith(`${userId}/drafts/${outletId}/`)
    && /\.(jpe?g|png|webp)$/i.test(path!)
}

async function optimizeUploadedPhoto(supabase: Awaited<ReturnType<typeof createServerClient>>, rawPath: string) {
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(rawPath)
    if (error || !data) throw new Error(error?.message ?? 'Foto asli tidak ditemukan.')

    const { default: sharp } = await import('sharp')
    const webp = await sharp(Buffer.from(await data.arrayBuffer()), { limitInputPixels: 40_000_000, sequentialRead: true })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(rawPath, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: true })
    if (uploadError) throw new Error(uploadError.message)

    return rawPath
  } catch (error) {
    console.error('[inventaris] optimasi foto background gagal', { rawPath, error })
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Sesi login tidak ditemukan.', 401)

  const formData = await request.formData()
  const outletId = String(formData.get('outlet_id') ?? '')
  const itemId = String(formData.get('item_id') ?? '')
  const previousPath = String(formData.get('previous_path') ?? '').trim() || null
  const photo = formData.get('photo')

  if (!UUID_PATTERN.test(outletId) || !UUID_PATTERN.test(itemId)) return errorResponse('Referensi outlet atau item tidak valid.')
  if (!(photo instanceof File) || photo.size === 0) return errorResponse('Foto belum dipilih.')
  if (photo.size > MAX_INPUT_FILE_BYTES) return errorResponse('Ukuran foto terlalu besar. Maksimal 50 MB per foto.')
  if (!ALLOWED_IMAGE_TYPES.has(photo.type.toLowerCase())) return errorResponse('Format foto harus JPG, PNG, atau WebP.')

  const { data: allowedData, error: allowedError } = await supabase.rpc('accessible_outlet_ids')
  if (allowedError) return errorResponse(allowedError.message, 403)
  if (!getAccessibleIds(allowedData).includes(outletId)) return errorResponse('Outlet di luar scope akses Anda.', 403)

  const { data: masterItem, error: masterError } = await supabase
    .from('inventaris_master_items')
    .select('id')
    .eq('id', itemId)
    .eq('is_active', true)
    .maybeSingle()
  if (masterError) return errorResponse(masterError.message, 500)
  if (!masterItem) return errorResponse('Item inventaris tidak valid.')

  try {
    // File asli langsung diterima pada path sementara. Server menimpanya
    // dengan byte WebP pada proses background setelah respons dikirim.
    const path = `${user.id}/drafts/${outletId}/pending/${itemId}-${crypto.randomUUID()}.webp`
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, photo, { contentType: photo.type, cacheControl: '3600', upsert: false })
    if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`)

    if (isOwnedDraftPath(previousPath, user.id, outletId)) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath!])
    }

    const { data: signedUrlData } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 24 * 60 * 60)
    // Browser sudah mengecilkan foto menjadi WebP <=1024px sebelum mengunggah,
    // jadi tidak ada yang perlu dikerjakan sharp. Melewatinya juga menghindari
    // pekerjaan sia-sia: bucket ini hanya punya policy INSERT/SELECT/DELETE,
    // sehingga upload ulang dengan upsert SELALU ditolak RLS ("new row violates
    // row-level security policy") setelah men-download dan mengonversi ulang.
    const alreadyOptimized = photo.type.toLowerCase() === 'image/webp' && photo.size <= OPTIMIZED_PHOTO_MAX_BYTES
    if (!alreadyOptimized) {
      after(async () => {
        await optimizeUploadedPhoto(supabase, path)
      })
    }
    return NextResponse.json({ ok: true, photo_path: path, photo_url: signedUrlData?.signedUrl ?? null, optimizing: !alreadyOptimized })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Gagal memproses foto.', 500)
  }
}

/** Foto bukti untuk laporan. Jalur ini tersedia untuk admin dan regional manager. */
export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Sesi login tidak ditemukan.', 401)

  const { data: staff, error: staffError } = await supabase
    .from('outlet_staff')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (staffError || !staff || !['admin', 'regional_manager'].includes(staff.role)) return errorResponse('Akses laporan hanya untuk admin atau regional manager.', 403)

  const path = new URL(request.url).searchParams.get('path')?.trim() ?? ''
  if (!isSafePhotoPath(path)) return errorResponse('Path foto tidak valid.')

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 10 * 60)
  if (error || !data?.signedUrl) return errorResponse('Foto tidak tersedia.', 404)
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
