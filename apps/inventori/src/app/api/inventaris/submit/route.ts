import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createSupabaseServerClient } from '@suka/auth'

export const runtime = 'nodejs'

const PHOTO_BUCKET = 'inventaris-foto'
const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024
const PHOTO_PROCESS_CONCURRENCY = 4
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const CONDITIONS = new Set(['baik', 'perlu_perbaikan', 'rusak', 'tidak_ada'])

type SubmittedItem = {
  master_item_id: string
  observed_qty: number | null
  is_present: boolean | null
  kondisi: string
  catatan: string | null
  photo_path?: string | null
}

type Payload = {
  outlet_id: string
  tanggal: string
  area_scores: Record<string, unknown>
  notes: string | null
  items: SubmittedItem[]
}

type MasterItem = {
  id: string
  mode: 'quantity' | 'presence' | 'range'
  target_qty: number | null
  target_min: number | null
  target_max: number | null
}

type CurrentSubmission = {
  id: string
  outlet_id: string
  tanggal: string
  area_scores: Record<string, unknown>
  notes: string | null
  updated_at: string
}

type CurrentSubmissionItem = SubmittedItem & {
  photo_path: string
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function getAccessibleIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => typeof row === 'string' ? row : (row as { accessible_outlet_ids?: string } | null)?.accessible_outlet_ids)
    .filter((id): id is string => Boolean(id))
}

function evaluate(item: MasterItem, submitted: SubmittedItem): string {
  if (item.mode === 'presence') return submitted.is_present ? 'sesuai' : 'tidak_ada'
  if (submitted.observed_qty === null || !Number.isFinite(submitted.observed_qty)) return 'kurang'
  if (item.mode === 'range') {
    return submitted.observed_qty >= Number(item.target_min) && submitted.observed_qty <= Number(item.target_max)
      ? 'sesuai'
      : 'di_luar_target'
  }
  return submitted.observed_qty >= Number(item.target_qty) ? 'sesuai' : 'kurang'
}

async function createServerClient() {
  const cookieStore = await cookies()
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
      })
    },
  })
  return supabase
}

async function getCurrentSubmission(supabase: Awaited<ReturnType<typeof createServerClient>>, outletId: string) {
  const { data, error } = await supabase
    .from('inventaris_submissions')
    .select('id, outlet_id, tanggal, area_scores, notes, updated_at')
    .eq('outlet_id', outletId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as CurrentSubmission | null) ?? null
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Sesi login tidak ditemukan.', 401)

  const outletId = new URL(request.url).searchParams.get('outlet_id')
  if (!outletId) return errorResponse('Outlet wajib dipilih.')

  const { data: allowedData, error: allowedError } = await supabase.rpc('accessible_outlet_ids')
  if (allowedError) return errorResponse(allowedError.message, 403)
  if (!getAccessibleIds(allowedData).includes(outletId)) {
    return errorResponse('Outlet di luar scope akses Anda.', 403)
  }

  try {
    const submission = await getCurrentSubmission(supabase, outletId)
    if (!submission) return NextResponse.json({ submission: null })

    const { data: itemData, error: itemError } = await supabase
      .from('inventaris_submission_items')
      .select('master_item_id, observed_qty, is_present, kondisi, catatan, photo_path')
      .eq('submission_id', submission.id)
    if (itemError) return errorResponse(itemError.message, 500)

    const items = await Promise.all(((itemData ?? []) as CurrentSubmissionItem[]).map(async (item) => {
      const { data: signedUrlData } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(item.photo_path, 60 * 60)
      return { ...item, photo_url: signedUrlData?.signedUrl ?? null }
    }))

    return NextResponse.json({ submission: { ...submission, items } })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Gagal memuat inventaris.', 500)
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Sesi login tidak ditemukan.', 401)

  const formData = await request.formData()
  const rawPayload = formData.get('payload')
  if (typeof rawPayload !== 'string') return errorResponse('Payload inventaris tidak valid.')

  let payload: Payload
  try {
    payload = JSON.parse(rawPayload) as Payload
  } catch {
    return errorResponse('Payload inventaris tidak valid.')
  }

  if (!payload.outlet_id || !payload.tanggal || !Array.isArray(payload.items)) {
    return errorResponse('Data inventaris belum lengkap.')
  }

  const { data: allowedData, error: allowedError } = await supabase.rpc('accessible_outlet_ids')
  if (allowedError) return errorResponse(allowedError.message, 403)
  if (!getAccessibleIds(allowedData).includes(payload.outlet_id)) {
    return errorResponse('Outlet di luar scope akses Anda.', 403)
  }

  let currentSubmission: CurrentSubmission | null
  try {
    currentSubmission = await getCurrentSubmission(supabase, payload.outlet_id)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Gagal memuat inventaris lama.', 500)
  }

  let existingItems: Array<{ master_item_id: string; photo_path: string }> = []
  if (currentSubmission) {
    const { data: existingItemData, error: existingItemError } = await supabase
      .from('inventaris_submission_items')
      .select('master_item_id, photo_path')
      .eq('submission_id', currentSubmission.id)
    if (existingItemError) return errorResponse(existingItemError.message, 500)
    existingItems = (existingItemData ?? []) as Array<{ master_item_id: string; photo_path: string }>
  }
  const existingPhotoPaths = new Set(existingItems.map((item) => item.photo_path))

  const { data: masterItems, error: masterError } = await supabase
    .from('inventaris_master_items')
    .select('id, mode, target_qty, target_min, target_max')
    .eq('is_active', true)
  if (masterError) return errorResponse(masterError.message, 500)

  const masters = (masterItems ?? []) as MasterItem[]
  const submittedIds = payload.items.map((item) => item.master_item_id)
  const masterById = new Map(masters.map((item) => [item.id, item]))
  if (payload.items.length !== masters.length || new Set(submittedIds).size !== submittedIds.length || submittedIds.some((id) => !masterById.has(id))) {
    return errorResponse('Detail inventaris belum lengkap.')
  }

  for (const item of payload.items) {
    if (!CONDITIONS.has(item.kondisi)) return errorResponse('Kondisi item tidak valid.')
    if (item.observed_qty !== null && (!Number.isFinite(item.observed_qty) || item.observed_qty < 0)) {
      return errorResponse('Jumlah item tidak valid.')
    }
    const photo = formData.get(`photo_${item.master_item_id}`)
    const existingPhotoPath = item.photo_path?.trim() || null
    if (!(photo instanceof File) || photo.size === 0) {
      if (!existingPhotoPath || !existingPhotoPaths.has(existingPhotoPath)) {
        return errorResponse('Foto wajib diisi untuk setiap item.')
      }
    } else {
      if (photo.size > MAX_INPUT_FILE_BYTES) return errorResponse('Ukuran foto terlalu besar. Maksimal 12 MB per foto.')
      if (!ALLOWED_IMAGE_TYPES.has(photo.type.toLowerCase())) return errorResponse('Format foto harus JPG, PNG, atau WebP.')
    }
  }

  const submissionId = currentSubmission?.id ?? crypto.randomUUID()
  const uploadedPaths: string[] = []
  try {
    const detailRows: Array<Record<string, string | number | boolean | null>> = []
    // Kompres/upload beberapa foto sekaligus. Concurrency dibatasi agar CPU
    // dan koneksi VPS tetap stabil saat satu outlet punya banyak item.
    for (let start = 0; start < payload.items.length; start += PHOTO_PROCESS_CONCURRENCY) {
      const batch = payload.items.slice(start, start + PHOTO_PROCESS_CONCURRENCY)
      const rows = await Promise.all(batch.map(async (item) => {
        const master = masterById.get(item.master_item_id) as MasterItem
        const photo = formData.get(`photo_${item.master_item_id}`)
        let path = item.photo_path?.trim() || null
        if (photo instanceof File && photo.size > 0) {
          const input = Buffer.from(await photo.arrayBuffer())
          const webp = await sharp(input)
            .rotate()
            .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 78 })
            .toBuffer()
          const uploadId = crypto.randomUUID()
          path = `${user.id}/${submissionId}/${item.master_item_id}-${uploadId}.webp`
          const webpBody = new Blob([
            webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer,
          ], { type: 'image/webp' })
          const { error: uploadError } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(path, webpBody, { contentType: 'image/webp', upsert: false })
          if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`)
          uploadedPaths.push(path)
        }
        if (!path) throw new Error(`Foto ${item.master_item_id} belum tersedia.`)
        return {
          master_item_id: item.master_item_id,
          observed_qty: master.mode === 'presence' ? null : item.observed_qty,
          is_present: master.mode === 'presence' ? item.is_present : null,
          kondisi: item.kondisi,
          status_penilaian: evaluate(master, item),
          catatan: item.catatan?.trim() || null,
          photo_path: path,
        }
      }))
      detailRows.push(...rows)
    }

    const { error: submitError } = await supabase.rpc('submit_inventaris', {
      p_submission_id: submissionId,
      p_outlet_id: payload.outlet_id,
      p_tanggal: payload.tanggal,
      p_area_scores: payload.area_scores ?? {},
      p_notes: payload.notes?.trim() || null,
      p_items: detailRows,
    })
    if (submitError) {
      throw new Error(submitError.message)
    }

    const oldPaths = existingItems.map((item) => item.photo_path)
    const retainedPaths = new Set(detailRows.map((row) => row.photo_path).filter((path): path is string => typeof path === 'string'))
    const replacedPaths = oldPaths.filter((path) => !retainedPaths.has(path))
    if (replacedPaths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(replacedPaths)

    return NextResponse.json({ ok: true, submission_id: submissionId, updated: Boolean(currentSubmission) })
  } catch (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths)
    return errorResponse(error instanceof Error ? error.message : 'Gagal menyimpan inventaris.', 500)
  }
}
