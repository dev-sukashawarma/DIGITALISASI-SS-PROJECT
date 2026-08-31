import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { createSupabaseServerClient } from '@suka/auth'

export const runtime = 'nodejs'

const PHOTO_BUCKET = 'inventaris-foto'
const MAX_INPUT_FILE_BYTES = 12 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const CONDITIONS = new Set(['baik', 'perlu_perbaikan', 'rusak', 'tidak_ada'])

type SubmittedItem = {
  master_item_id: string
  observed_qty: number | null
  is_present: boolean | null
  kondisi: string
  catatan: string | null
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
    if (!(photo instanceof File) || photo.size === 0) return errorResponse('Foto wajib diisi untuk setiap item.')
    if (photo.size > MAX_INPUT_FILE_BYTES) return errorResponse('Ukuran foto terlalu besar. Maksimal 12 MB per foto.')
    if (!ALLOWED_IMAGE_TYPES.has(photo.type.toLowerCase())) return errorResponse('Format foto harus JPG, PNG, atau WebP.')
  }

  const submissionId = crypto.randomUUID()
  const uploadedPaths: string[] = []
  try {
    const detailRows: Array<Record<string, string | number | boolean | null>> = []
    for (const item of payload.items) {
      const master = masterById.get(item.master_item_id) as MasterItem
      const photo = formData.get(`photo_${item.master_item_id}`) as File
      const input = Buffer.from(await photo.arrayBuffer())
      const webp = await sharp(input)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer()
      const path = `${user.id}/${submissionId}/${item.master_item_id}.webp`
      const webpBody = new Blob([
        webp.buffer.slice(webp.byteOffset, webp.byteOffset + webp.byteLength) as ArrayBuffer,
      ], { type: 'image/webp' })
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, webpBody, { contentType: 'image/webp', upsert: false })
      if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`)
      uploadedPaths.push(path)
      detailRows.push({
        master_item_id: item.master_item_id,
        observed_qty: master.mode === 'presence' ? null : item.observed_qty,
        is_present: master.mode === 'presence' ? item.is_present : null,
        kondisi: item.kondisi,
        status_penilaian: evaluate(master, item),
        catatan: item.catatan?.trim() || null,
        photo_path: path,
      })
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
      throw new Error(submitError.message.includes('duplicate') ? 'Inventaris outlet ini sudah dicatat hari ini.' : submitError.message)
    }

    return NextResponse.json({ ok: true, submission_id: submissionId })
  } catch (error) {
    if (uploadedPaths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths)
    return errorResponse(error instanceof Error ? error.message : 'Gagal menyimpan inventaris.', 500)
  }
}
