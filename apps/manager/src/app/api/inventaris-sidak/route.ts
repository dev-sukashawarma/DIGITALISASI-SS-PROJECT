import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth'
import { getAdminClient, getScopedOutletIds } from '@/lib/inventaris-sidak-server'

type CheckInput = { submission_item_id: string; status: 'ok' | 'issue'; note?: string }

export async function POST(request: Request) {
  const staff = parseStaffHeader((await headers()).get(STAFF_HEADER))
  if (!staff || !['regional_manager', 'area_manager'].includes(staff.role)) return NextResponse.json({ error: 'Akses sidak tidak tersedia.' }, { status: 403 })
  const body = await request.json() as { submission_id?: string; note?: string; checks?: CheckInput[] }
  if (!body.submission_id || !Array.isArray(body.checks)) return NextResponse.json({ error: 'Data sidak belum lengkap.' }, { status: 400 })

  const db = getAdminClient()
  const allowedIds = await getScopedOutletIds(db, staff)
  const { data: submission, error: submissionError } = await db.from('inventaris_submissions').select('id, outlet_id').eq('id', body.submission_id).maybeSingle()
  if (submissionError) return NextResponse.json({ error: submissionError.message }, { status: 500 })
  if (!submission || !allowedIds.includes(submission.outlet_id)) return NextResponse.json({ error: 'Outlet di luar scope akses Anda.' }, { status: 403 })

  const { data: sourceItems, error: sourceError } = await db.from('inventaris_submission_items').select('id').eq('submission_id', body.submission_id)
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  const validIds = new Set((sourceItems ?? []).map((item) => item.id as string))
  const checks = body.checks.filter((check) => validIds.has(check.submission_item_id))
  if (checks.length !== validIds.size || new Set(checks.map((check) => check.submission_item_id)).size !== validIds.size || checks.some((check) => !['ok', 'issue'].includes(check.status))) {
    return NextResponse.json({ error: 'Setiap item inventaris harus diberi hasil sidak.' }, { status: 400 })
  }

  const { data: review, error: reviewError } = await db.from('inventaris_sidak_reviews').upsert({ submission_id: body.submission_id, reviewer_id: staff.id, status: 'final', note: body.note?.trim() || null, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }, { onConflict: 'submission_id' }).select('id').single()
  if (reviewError || !review) return NextResponse.json({ error: reviewError?.message ?? 'Review sidak gagal disimpan.' }, { status: 500 })
  const { error: deleteError } = await db.from('inventaris_sidak_review_items').delete().eq('review_id', review.id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  const { error: itemsError } = await db.from('inventaris_sidak_review_items').insert(checks.map((check) => ({ review_id: review.id, submission_item_id: check.submission_item_id, status: check.status, note: check.note?.trim() || null })))
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  return NextResponse.json({ ok: true, review_id: review.id })
}
