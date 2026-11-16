'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import type { OutletFormValues } from '@/lib/types'
import {
  nonaktifkanOutletDiOrderOnline,
  sinkronOutletKeOrderOnline,
} from '@/lib/outlets/orderOnlineSync'
import { cekHapusOutlet, cekPerubahanOutlet } from '@/lib/outlets/aturanEdit'
import { OUTLET_COLUMNS } from '@/lib/managedOutlets'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function createOutlet(values: OutletFormValues) {
  const supabase = await getSupabase()

  const outletId = crypto.randomUUID()
  const status = values.status || (values.is_active ? 'active' : 'pending')
  const isActive = status === 'active'

  // 1. Insert ke Digitalisasi (Primary)
  const { data: insertedOutlet, error: primaryError } = await supabase
    .from('outlets')
    .insert({
      id: outletId,
      name: values.name,
      slug: values.slug,
      address: values.address || null,
      lat: values.lat,
      lng: values.lng,
      type: values.type,
      status,
      is_active: isActive,
      marquee_warning_threshold: values.marquee_warning_threshold,
      open_hour: values.open_hour || '14:00',
      close_hour: values.close_hour || '22:00',
      ...(values.phone !== undefined && { phone: values.phone.trim() || null }),
      ...(values.region !== undefined && { region: values.region.trim() || null }),
      ...(values.bank_name !== undefined && { bank_name: values.bank_name.trim() || null }),
      ...(values.bank_account_number !== undefined && { bank_account_number: values.bank_account_number.trim() || null }),
      ...(values.bank_account_name !== undefined && { bank_account_name: values.bank_account_name.trim() || null }),
      ...(values.requires_korlap_review !== undefined && { requires_korlap_review: values.requires_korlap_review }),
    })
    .select(OUTLET_COLUMNS)
    .single()

  if (primaryError) throw new Error(primaryError.message)

  // 2. Sinkronkan ke Form Order + generate user otomatis + kirim kredensial ke @devsshermesbot
  try {
    await sinkronOutletKeOrderOnline(
      {
        id: insertedOutlet.id,
        slug: insertedOutlet.slug,
        name: insertedOutlet.name,
        address: insertedOutlet.address ?? null,
        lat: insertedOutlet.lat ?? null,
        lng: insertedOutlet.lng ?? null,
        phone: insertedOutlet.phone ?? null,
        type: insertedOutlet.type,
        status: insertedOutlet.status ?? status,
        is_active: insertedOutlet.is_active,
        open_hour: insertedOutlet.open_hour ?? '14:00',
        close_hour: insertedOutlet.close_hour ?? '22:00',
      },
      { mode: 'buat' },
    )
  } catch (error: any) {
    // Rollback outlet baru yang belum punya data bila sinkron Form Order gagal
    await supabase.from('outlets').delete().eq('id', outletId)
    throw new Error(`Order Online Sync Error: ${error.message}`)
  }

  revalidatePath('/dashboard/outlets')
  return insertedOutlet
}

export async function updateOutlet(id: string, values: OutletFormValues) {
  const supabase = await getSupabase()

  const status = values.status || (values.is_active ? 'active' : 'inactive')
  const isActive = status === 'active'

  const { data: lama, error: errLama } = await supabase
    .from('outlets')
    .select('status, type, name')
    .eq('id', id)
    .single()
  if (errLama) throw new Error(errLama.message)

  const ditolak = cekPerubahanOutlet(lama, { status, type: values.type })
  if (ditolak) throw new Error(ditolak)

  const payload: Record<string, unknown> = {
    name: values.name,
    slug: values.slug,
    address: values.address || null,
    lat: values.lat,
    lng: values.lng,
    type: values.type,
    status,
    is_active: isActive,
    marquee_warning_threshold: values.marquee_warning_threshold,
    open_hour: values.open_hour || '14:00',
    close_hour: values.close_hour || '22:00',
    ...(values.phone !== undefined && { phone: values.phone.trim() || null }),
    ...(values.region !== undefined && { region: values.region.trim() || null }),
    ...(values.bank_name !== undefined && { bank_name: values.bank_name.trim() || null }),
    ...(values.bank_account_number !== undefined && { bank_account_number: values.bank_account_number.trim() || null }),
    ...(values.bank_account_name !== undefined && { bank_account_name: values.bank_account_name.trim() || null }),
    ...(values.requires_korlap_review !== undefined && { requires_korlap_review: values.requires_korlap_review }),
    updated_at: new Date().toISOString(),
  }

  // deleted_at sengaja tidak disentuh: hanya "Hapus" (softDeleteOutlet) yang
  // mengisinya. Menonaktifkan outlet tidak menghapusnya dari daftar.

  // 1. Update primary
  const { data: updatedOutlet, error: primaryError } = await supabase
    .from('outlets')
    .update(payload)
    .eq('id', id)
    .select(OUTLET_COLUMNS)
    .single()
  if (primaryError) throw new Error(primaryError.message)

  // 2. Sinkronkan perubahan (termasuk perubahan tipe Internal <-> Mitra & status) ke Form Order + Telegram
  try {
    await sinkronOutletKeOrderOnline(
      {
        id: updatedOutlet.id,
        slug: updatedOutlet.slug,
        name: updatedOutlet.name,
        address: updatedOutlet.address ?? null,
        lat: updatedOutlet.lat ?? null,
        lng: updatedOutlet.lng ?? null,
        phone: updatedOutlet.phone ?? null,
        type: updatedOutlet.type,
        status: updatedOutlet.status ?? status,
        is_active: updatedOutlet.is_active,
        open_hour: updatedOutlet.open_hour ?? '14:00',
        close_hour: updatedOutlet.close_hour ?? '22:00',
      },
      {
        mode: 'ubah',
        tipeSebelumnya: lama.type,
        namaSebelumnya: lama.name,
      },
    )
  } catch (err) {
    console.error('Failed to sync outlet update to order online:', err)
    if (lama.type !== updatedOutlet.type) {
      throw new Error(
        `Outlet diperbarui di Dashboard, tetapi gagal memperbarui akun Form Order: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  revalidatePath('/dashboard/outlets')
  return updatedOutlet
}

export async function softDeleteOutlet(id: string) {
  const supabase = await getSupabase()

  const { data: lama, error: errLama } = await supabase.from('outlets').select('status, type').eq('id', id).single()
  if (errLama) throw new Error(errLama.message)
  const ditolak = cekHapusOutlet(lama)
  if (ditolak) throw new Error(ditolak)

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('outlets')
    .update({
      status: 'inactive',
      is_active: false,
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  try {
    await nonaktifkanOutletDiOrderOnline(id)
  } catch (err) {
    console.warn('Gagal menonaktifkan outlet di Order Online:', err)
  }

  revalidatePath('/dashboard/outlets')
  return { id, is_active: false, status: 'inactive' as const, deleted_at: now }
}

export async function hardDeleteOutlet(id: string) {
  // ATURAN MUTLAK: Selalu gunakan soft delete agar data omzet, transaksi,
  // dan catatan historis masa lalu tidak hilang.
  return softDeleteOutlet(id)
}
