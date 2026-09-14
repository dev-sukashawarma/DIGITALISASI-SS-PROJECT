'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import type { OutletFormValues } from '@/lib/types'

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
  
  // 1. Insert into Digitalisasi (Primary)
  const { error: primaryError } = await supabase.from('outlets').insert({
    id: outletId,
    name: values.name,
    slug: values.slug,
    address: values.address || null,
    lat: values.lat,
    lng: values.lng,
    type: values.type,
    is_active: values.is_active,
    marquee_warning_threshold: values.marquee_warning_threshold,
    open_hour: values.open_hour || '14:00',
    close_hour: values.close_hour || '22:00',
  })
  
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
        type: values.type === 'owned' || values.type === 'partner' ? values.type : 'owned', // match order online schema
        is_active: values.is_active,
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
}

export async function updateOutlet(id: string, values: OutletFormValues) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const payload = {
    name: values.name,
    slug: values.slug,
    address: values.address || null,
    lat: values.lat,
    lng: values.lng,
    type: values.type,
    is_active: values.is_active,
    marquee_warning_threshold: values.marquee_warning_threshold,
    open_hour: values.open_hour || '14:00',
    close_hour: values.close_hour || '22:00',
    updated_at: new Date().toISOString(),
  }
  
  // 1. Update primary
  const { error: primaryError } = await supabase.from('outlets').update(payload).eq('id', id)
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
            type: values.type === 'owned' || values.type === 'partner' ? values.type : 'owned',
            is_active: values.is_active,
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
          type: values.type === 'owned' || values.type === 'partner' ? values.type : 'owned',
          is_active: values.is_active,
          open_hour: values.open_hour || '14:00',
          close_hour: values.close_hour || '22:00',
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error("Order Online connection failed", err)
    }
  }
}

export async function softDeleteOutlet(id: string) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const { error } = await supabase.from('outlets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  
  if (orderOnline) {
    try {
      await orderOnline.from('outlets')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
    } catch(err) { console.warn(err) }
  }
}

export async function hardDeleteOutlet(id: string) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const { error } = await supabase.from('outlets').delete().eq('id', id)
  if (error) throw new Error(error.message)
  
  if (orderOnline) {
    try {
      await orderOnline.from('outlets')
        .delete()
        .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
    } catch(err) { console.warn(err) }
  }
}

