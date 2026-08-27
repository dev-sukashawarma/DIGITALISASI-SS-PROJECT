'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'

export interface MitraBiodata {
  id: string
  user_id: string
  nama_mitra: string
  outlet_ids: string[]
  nik?: string
  phone?: string
  email?: string
  alamat_domisili?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_holder?: string
  no_pks?: string
  tanggal_pks?: string
  tanggal_berakhir_pks?: string
  profit_sharing_pct?: number
  status?: 'aktif' | 'nonaktif' | 'dalam_perpanjangan'
  created_at?: string
  updated_at?: string
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function getMitraBiodata(): Promise<MitraBiodata | null> {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('mitra_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching mitra biodata:', error)
    return null
  }

  return data || null
}

export async function upsertMitraProfileFull(data: {
  user_id: string
  nama_mitra: string
  outlet_ids: string[]
  nik?: string
  phone?: string
  email?: string
  alamat_domisili?: string
  bank_name?: string
  bank_account_number?: string
  bank_account_holder?: string
  no_pks?: string
  tanggal_pks?: string
  tanggal_berakhir_pks?: string
  profit_sharing_pct?: number
  status?: 'aktif' | 'nonaktif' | 'dalam_perpanjangan'
  previous_user_id?: string
}) {
  const supabase = await getSupabase()

  // Security check: ensure caller is admin/owner
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  if (data.previous_user_id && data.previous_user_id !== data.user_id) {
    await supabase.from('mitra_profiles').delete().eq('user_id', data.previous_user_id)
  }

  const payload: any = {
    user_id: data.user_id,
    nama_mitra: data.nama_mitra.trim(),
    outlet_ids: data.outlet_ids,
    nik: data.nik?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    alamat_domisili: data.alamat_domisili?.trim() || null,
    bank_name: data.bank_name?.trim() || null,
    bank_account_number: data.bank_account_number?.trim() || null,
    bank_account_holder: data.bank_account_holder?.trim() || null,
    no_pks: data.no_pks?.trim() || null,
    tanggal_pks: data.tanggal_pks || null,
    tanggal_berakhir_pks: data.tanggal_berakhir_pks || null,
    profit_sharing_pct: Number(data.profit_sharing_pct) || 50.00,
    status: data.status || 'aktif',
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase.from('mitra_profiles').upsert(payload, { onConflict: 'user_id' })
  
  if (error) {
    console.error('upsertMitraProfileFull error:', error)
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/owner/kelola-mitra')
  revalidatePath('/dashboard/mitra')
}
