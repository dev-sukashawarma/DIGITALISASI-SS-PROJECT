'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getVerifiedUserId } from '@suka/auth'
import { DEFAULT_MITRA_MAINTENANCE_HTML, type MitraMaintenanceConfig } from '@/lib/maintenance/mitraMaintenance'

const SETTINGS_KEY = 'mitra_maintenance_config'

/**
 * Validasi otorisasi server-side khusus role developer.
 */
async function requireDeveloper(): Promise<{ userId: string; name: string }> {
  const supabase = await createClient()
  const userId = await getVerifiedUserId(supabase)
  if (!userId) {
    throw new Error('Unauthorized: sesi tidak ditemukan')
  }

  const { data: staff, error } = await supabase
    .from('outlet_staff')
    .select('role, name, status')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  if (!staff || staff.status !== 'active' || staff.role?.toLowerCase() !== 'developer') {
    throw new Error('Forbidden: aksi ini khusus untuk role Developer')
  }

  return { userId, name: staff.name || 'Developer' }
}

/**
 * Ambil konfigurasi maintenance mitra dari global_settings.
 */
export async function getMitraMaintenanceConfigAction(): Promise<MitraMaintenanceConfig> {
  const svc = createServiceClient()
  const { data, error } = await svc
    .from('global_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle()

  if (error) {
    console.error('Error fetching mitra maintenance config:', error.message)
    return {
      is_active: false,
      custom_html: DEFAULT_MITRA_MAINTENANCE_HTML,
    }
  }

  if (!data?.value) {
    return {
      is_active: false,
      custom_html: DEFAULT_MITRA_MAINTENANCE_HTML,
    }
  }

  const val = data.value as any
  const rawHtml = typeof val.custom_html === 'string' ? val.custom_html : ''
  return {
    is_active: Boolean(val.is_active),
    custom_html: rawHtml.trim().length > 0 ? rawHtml : DEFAULT_MITRA_MAINTENANCE_HTML,
    updated_at: val.updated_at,
    updated_by: val.updated_by,
  }
}

/**
 * Simpan konfigurasi maintenance mitra ke global_settings (khusus Developer).
 */
export async function saveMitraMaintenanceConfigAction(input: {
  is_active: boolean
  custom_html: string
}) {
  const { name } = await requireDeveloper()

  const svc = createServiceClient()
  const now = new Date().toISOString()

  const payload: MitraMaintenanceConfig = {
    is_active: Boolean(input.is_active),
    custom_html: input.custom_html ?? '',
    updated_at: now,
    updated_by: name,
  }

  const { error } = await svc
    .from('global_settings')
    .upsert({
      key: SETTINGS_KEY,
      value: payload,
      updated_at: now,
    }, { onConflict: 'key' })

  if (error) {
    throw new Error(`Gagal menyimpan pengaturan: ${error.message}`)
  }

  // Revalidasi jalur agar perubahan langsung terasa
  revalidatePath('/dashboard/sistem/pengaturan-halaman')
  revalidatePath('/dashboard/mitra')
  revalidatePath('/dashboard/mitra/transfer')
  revalidatePath('/dashboard/mitra/tim')
  revalidatePath('/dashboard/mitra/saran')

  return { ok: true, data: payload }
}
