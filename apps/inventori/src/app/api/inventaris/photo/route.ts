import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@suka/auth'

export const runtime = 'nodejs'

const PHOTO_BUCKET = 'inventaris-foto'
const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
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
    && path!.toLowerCase().endsWith('.webp')
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
  if (photo.size > MAX_INPUT_FILE_BYTES) return errorResponse('Ukuran foto terlalu besar. Maksimal 12 MB per foto.')
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
    const { default: sharp } = await import('sharp')
    const input = Buffer.from(await photo.arrayBuffer())
    const webp = await sharp(input, { limitInputPixels: 40_000_000, sequentialRead: true })
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
    const path = `${user.id}/drafts/${outletId}/${itemId}-${crypto.randomUUID()}.webp`
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`)

    if (isOwnedDraftPath(previousPath, user.id, outletId)) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath!])
    }

    const { data: signedUrlData } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 24 * 60 * 60)
    return NextResponse.json({ ok: true, photo_path: path, photo_url: signedUrlData?.signedUrl ?? null })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Gagal memproses foto.', 500)
  }
}
