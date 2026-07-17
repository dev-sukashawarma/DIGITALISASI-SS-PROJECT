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
  })
  
  if (primaryError) throw new Error(primaryError.message)
  
  // 2. Insert into Order Online (Secondary)
  try {
    const { error: secondaryError } = await orderOnline.from('outlets').insert({
      id: outletId,
      name: values.name,
      slug: values.slug,
      address: values.address || '-',
      lat: values.lat || null,
      lng: values.lng || null,
      type: values.type === 'owned' || values.type === 'partner' ? values.type : 'owned', // match order online schema
      is_active: values.is_active,
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
    updated_at: new Date().toISOString(),
  }
  
  // 1. Update primary
  const { error: primaryError } = await supabase.from('outlets').update(payload).eq('id', id)
  if (primaryError) throw new Error(primaryError.message)
  
  // 2. Update secondary (Order Online might not have this outlet yet if it's an old one)
  try {
    // Try to update first
    const { error: secondaryError, count } = await orderOnline.from('outlets')
      .update({
        name: values.name,
        slug: values.slug,
        address: values.address || '-',
        lat: values.lat || null,
        lng: values.lng || null,
        type: values.type === 'owned' || values.type === 'partner' ? values.type : 'owned',
        is_active: values.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      
    // If we use upsert, we might need all required fields, but update is safer.
    // If it doesn't exist, we just ignore it since it's an old outlet not synced? 
    // Actually, let's upsert it so it becomes available in Order Online!
    if (secondaryError) {
       console.error("Failed to sync outlet update to order online", secondaryError)
    }
  } catch (err) {
    console.error("Order Online connection failed", err)
  }
}

export async function softDeleteOutlet(id: string) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const { error } = await supabase.from('outlets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  
  await orderOnline.from('outlets').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function hardDeleteOutlet(id: string) {
  const supabase = await getSupabase()
  let orderOnline: any = null
  try { orderOnline = createOrderOnlineAdminClient() } catch (e) { console.warn('Order Online not configured, skipping sync') }
  
  const { error } = await supabase.from('outlets').delete().eq('id', id)
  if (error) throw new Error(error.message)
  
  await orderOnline.from('outlets').delete().eq('id', id)
}
