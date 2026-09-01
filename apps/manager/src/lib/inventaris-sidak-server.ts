import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { OutletStaffProfile } from '@suka/auth'

export type SidakOutlet = { id: string; name: string; region: string | null }
export type SidakReview = {
  id: string
  status: 'draft' | 'final'
  note: string | null
  reviewer_id: string
  updated_at: string
  completed_at: string | null
  items: Array<{ submission_item_id: string; status: 'not_checked' | 'ok' | 'issue'; note: string | null }>
}
export type SidakSubmission = {
  id: string
  outlet_id: string
  submitted_by: string
  tanggal: string
  notes: string | null
  updated_at: string
  items: Array<{
    id: string
    master_item_id: string
    name: string
    section: string
    subsection: string
    mode: string
    target_qty: number | null
    target_min: number | null
    target_max: number | null
    unit: string | null
    observed_qty: number | null
    is_present: boolean | null
    kondisi: string
    status_penilaian: string
    catatan: string | null
    photo_path: string
  }>
}

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function getScopedOutletIds(db: SupabaseClient, staff: OutletStaffProfile) {
  if (staff.role === 'regional_manager') {
    const { data, error } = await db.from('outlets').select('id').eq('is_active', true)
    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => row.id as string)
  }

  const { data, error } = await db.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.outlet_id as string)
}

export async function getSidakData(staff: OutletStaffProfile) {
  const db = getAdminClient()
  const outletIds = await getScopedOutletIds(db, staff)
  if (outletIds.length === 0) return { outlets: [], submissions: [], reviews: [] as SidakReview[] }

  const [outletResult, submissionResult, masterResult] = await Promise.all([
    db.from('outlets').select('id, name, region').eq('is_active', true).in('id', outletIds).order('name'),
    db.from('inventaris_submissions').select('id, outlet_id, submitted_by, tanggal, notes, updated_at').in('outlet_id', outletIds).order('updated_at', { ascending: false }),
    db.from('inventaris_master_items').select('id, name, section, subsection, mode, target_qty, target_min, target_max, unit').eq('is_active', true).order('sort_order'),
  ])
  for (const result of [outletResult, submissionResult, masterResult]) if (result.error) throw new Error(result.error.message)

  const submissions = submissionResult.data ?? []
  const latestByOutlet = new Map<string, (typeof submissions)[number]>()
  for (const submission of submissions) if (!latestByOutlet.has(submission.outlet_id)) latestByOutlet.set(submission.outlet_id, submission)
  const latest = [...latestByOutlet.values()]
  const submissionIds = latest.map((submission) => submission.id)
  const [itemsResult, reviewsResult] = await Promise.all([
    submissionIds.length ? db.from('inventaris_submission_items').select('*').in('submission_id', submissionIds) : Promise.resolve({ data: [], error: null }),
    submissionIds.length ? db.from('inventaris_sidak_reviews').select('id, submission_id, status, note, reviewer_id, updated_at, completed_at, inventaris_sidak_review_items(submission_item_id, status, note)').in('submission_id', submissionIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (itemsResult.error) throw new Error(itemsResult.error.message)
  if (reviewsResult.error && !reviewsResult.error.message.includes('does not exist')) throw new Error(reviewsResult.error.message)

  const masterById = new Map((masterResult.data ?? []).map((master) => [master.id, master]))
  const itemsBySubmission = new Map<string, SidakSubmission['items']>()
  for (const item of itemsResult.data ?? []) {
    const master = masterById.get(item.master_item_id)
    if (!master) continue
    const current = itemsBySubmission.get(item.submission_id) ?? []
    current.push({ ...item, name: master.name, section: master.section, subsection: master.subsection, mode: master.mode, target_qty: master.target_qty, target_min: master.target_min, target_max: master.target_max, unit: master.unit })
    itemsBySubmission.set(item.submission_id, current)
  }
  const reviewRows = (reviewsResult.data ?? []) as Array<Record<string, unknown>>
  const reviews = reviewRows.map((review) => ({
    id: String(review.id), status: review.status as SidakReview['status'], note: (review.note as string | null) ?? null,
    reviewer_id: String(review.reviewer_id), updated_at: String(review.updated_at), completed_at: (review.completed_at as string | null) ?? null,
    items: ((review.inventaris_sidak_review_items as Array<Record<string, unknown>> | null) ?? []).map((item) => ({ submission_item_id: String(item.submission_item_id), status: item.status as 'not_checked' | 'ok' | 'issue', note: (item.note as string | null) ?? null })),
  }))
  return {
    outlets: (outletResult.data ?? []) as SidakOutlet[],
    submissions: latest.map((submission) => ({ ...submission, items: itemsBySubmission.get(submission.id) ?? [] })) as SidakSubmission[],
    reviews,
  }
}
