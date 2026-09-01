import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getAdminClient, getScopedOutletIds } from '@/lib/inventaris-sidak-server'

export async function GET(request: Request) {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  if (!staff || !['regional_manager', 'area_manager'].includes(staff.role)) return NextResponse.json({ error: 'Akses foto ditolak.' }, { status: 403 })
  const path = new URL(request.url).searchParams.get('path')?.trim() ?? ''
  if (!/^[0-9a-f-]{36}\/.+\.webp$/i.test(path) || path.includes('..')) return NextResponse.json({ error: 'Path foto tidak valid.' }, { status: 400 })
  const db = getAdminClient()
  const allowedIds = await getScopedOutletIds(db, staff)
  const { data: item } = await db.from('inventaris_submission_items').select('inventaris_submissions!inner(outlet_id)').eq('photo_path', path).maybeSingle()
  const linkedSubmission = item?.inventaris_submissions as { outlet_id?: string } | Array<{ outlet_id?: string }> | null
  const outletId = Array.isArray(linkedSubmission) ? linkedSubmission[0]?.outlet_id : linkedSubmission?.outlet_id
  if (!outletId || !allowedIds.includes(outletId)) return NextResponse.json({ error: 'Foto di luar scope akses Anda.' }, { status: 403 })
  const { data, error } = await db.storage.from(process.env.NEXT_PUBLIC_INVENTARIS_PHOTO_BUCKET || 'inventaris-foto').createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'Foto tidak tersedia.' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
