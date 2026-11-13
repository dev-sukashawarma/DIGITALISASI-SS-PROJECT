'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@suka/auth'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import type { OutletFormValues } from '@/lib/types'
import { tipeOrderOnline } from '@/lib/outlets/orderOnlineSync'
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
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const outletId = crypto.randomUUID()
  const status = values.status || (values.is_active ? 'active' : 'pending')
  const isActive = status === 'active'
  
  // 1. Insert into Digitalisasi (Primary)
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
      status: status,
      is_active: isActive,
      marquee_warning_threshold: values.marquee_warning_threshold,
      open_hour: values.open_hour || '14:00',
      close_hour: values.close_hour || '22:00',
    })
    .select('id, slug, name, address, lat, lng, type, is_active, status, marquee_warning_threshold, open_hour, close_hour, deleted_at')
    .single()
  
  if (primaryError) throw new Error(primaryError.message)
  
  // 2. Insert into Order Online (Secondary)
  if (orderOnline) {
    try {
      const { error: secondaryError } = await orderOnline.from('outlets').insert({
        id: outletId,
        pos_outlet_id: outletId,
        name: values.name,
        slug: values.slug,
        address: values.address || '-',
        lat: values.lat || null,
        lng: values.lng || null,
        type: tipeOrderOnline(values.type), // match order online schema
        is_active: isActive,
        open_hour: values.open_hour || '14:00',
        close_hour: values.close_hour || '22:00',
      })
      
      if (secondaryError) {
        // Rollback primary if secondary fails
        await supabase.from('outlets').delete().eq('id', outletId)
        throw new Error(`Order Online Sync Error: ${secondaryError.message}`)
      }
    } catch (error: any) {
      await supabase.from('outlets').delete().eq('id', outletId)
      throw new Error(error.message)
    }
  }

  revalidatePath('/dashboard/outlets')
  return insertedOutlet
}

export async function updateOutlet(id: string, values: OutletFormValues) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const status = values.status || (values.is_active ? 'active' : 'inactive')
  const isActive = status === 'active'

  const { data: lama, error: errLama } = await supabase.from('outlets').select('status, type').eq('id', id).single()
  if (errLama) throw new Error(errLama.message)
  const ditolak = cekPerubahanOutlet(lama, { status, type: values.type })
  if (ditolak) throw new Error(ditolak)

  const payload: any = {
    name: values.name,
    slug: values.slug,
    address: values.address || null,
    lat: values.lat,
    lng: values.lng,
    type: values.type,
    status: status,
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
  
  // 2. Update secondary (Order Online might not have this outlet yet if it's an old one)
  if (orderOnline) {
    try {
      const { data: existing } = await orderOnline.from('outlets')
        .select('id, slug')
        .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
        .maybeSingle()

      if (existing) {
        const { error: secondaryError } = await orderOnline.from('outlets')
          .update({
            name: values.name,
            slug: existing.slug || values.slug,
            address: values.address || '-',
            lat: values.lat || null,
            lng: values.lng || null,
            type: tipeOrderOnline(values.type),
            is_active: isActive,
            open_hour: values.open_hour || '14:00',
            close_hour: values.close_hour || '22:00',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (secondaryError) {
          console.error("Failed to sync outlet update to order online", secondaryError)
        }
      } else {
        await orderOnline.from('outlets').insert({
          id: id,
          pos_outlet_id: id,
          name: values.name,
          slug: values.slug,
          address: values.address || '-',
          lat: values.lat || null,
          lng: values.lng || null,
          type: tipeOrderOnline(values.type),
          is_active: isActive,
          open_hour: values.open_hour || '14:00',
          close_hour: values.close_hour || '22:00',
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error("Order Online connection failed", err)
    }
  }

  revalidatePath('/dashboard/outlets')
  return updatedOutlet
}

export async function softDeleteOutlet(id: string) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const { data: lama, error: errLama } = await supabase.from('outlets').select('status, type').eq('id', id).single()
  if (errLama) throw new Error(errLama.message)
  const ditolak = cekHapusOutlet(lama)
  if (ditolak) throw new Error(ditolak)

  const now = new Date().toISOString()
  const { error } = await supabase.from('outlets').update({
    status: 'inactive',
    is_active: false,
    deleted_at: now,
    updated_at: now
  }).eq('id', id)
  if (error) throw new Error(error.message)
  
  if (orderOnline) {
    try {
      await orderOnline.from('outlets')
        .update({ is_active: false, updated_at: now })
        .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
    } catch(err) { console.warn(err) }
  }

  revalidatePath('/dashboard/outlets')
  return { id, is_active: false, status: 'inactive' as const, deleted_at: now }
}

export async function hardDeleteOutlet(id: string) {
  // ATURAN MUTLAK: Selalu gunakan soft delete agar data omzet, transaksi,
  // dan catatan historis masa lalu tidak hilang.
  return softDeleteOutlet(id)
}

