import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { createServiceClient } from '@/lib/supabase/server'

const PHOTO_BUCKET = process.env.NEXT_PUBLIC_INVENTARIS_PHOTO_BUCKET || 'inventaris-foto'

function validPhotoPath(path: string) {
  return path.length > 0
    && path.length <= 1024
    && !path.includes('..')
    && /^[0-9a-f-]{36}\//i.test(path)
    && /\.webp$/i.test(path)
}

export async function GET(request: Request) {
  try {
    await requireRole(['admin', 'owner'])
    const path = new URL(request.url).searchParams.get('path')?.trim() ?? ''
    if (!validPhotoPath(path)) return NextResponse.json({ error: 'Path foto inventaris tidak valid.' }, { status: 400 })

    const supabase = createServiceClient()
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? 'Foto tidak tersedia.' }, { status: 404 })
    }

    return NextResponse.redirect(data.signedUrl, { status: 307 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengakses foto inventaris.'
    const status = message.startsWith('Unauthorized') || message.startsWith('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
