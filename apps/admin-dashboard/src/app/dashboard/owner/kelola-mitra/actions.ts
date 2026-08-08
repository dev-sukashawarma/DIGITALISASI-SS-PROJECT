'use server'

import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@suka/auth'
import { revalidatePath } from 'next/cache'

async function getSupabase() {
  const cookieStore = await cookies()
  return createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: () => {},
  })
}

export async function upsertMitraProfile(data: { user_id: string, nama_mitra: string, outlet_ids: string[], previous_user_id?: string }) {
  const supabase = await getSupabase()

  if (data.previous_user_id && data.previous_user_id !== data.user_id) {
    await supabase.from('mitra_profiles').delete().eq('user_id', data.previous_user_id)
  }

  const { error } = await supabase.from('mitra_profiles').upsert({
    user_id: data.user_id,
    nama_mitra: data.nama_mitra,
    outlet_ids: data.outlet_ids,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' })
  
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/owner/kelola-mitra')
}

export async function upsertInvestasi(data: { outlet_id: string, nilai_investasi: number, tanggal_mulai: string, catatan: string }) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('mitra_investments').upsert({
    outlet_id: data.outlet_id,
    nilai_investasi: data.nilai_investasi,
    tanggal_mulai: data.tanggal_mulai,
    catatan: data.catatan,
    updated_at: new Date().toISOString()
  }, { onConflict: 'outlet_id' })
  
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/owner/kelola-mitra')
}

export async function saveMitraTransfer(data: { outlet_id: string, bulan: string, nominal: number, bukti_url: string, catatan: string }) {
  const supabase = await getSupabase()
  
  // Format bulan to YYYY-MM-01 format for date column
  const dateObj = new Date(data.bulan)
  dateObj.setDate(1)
  
  const { error } = await supabase.from('mitra_transfers').insert({
    outlet_id: data.outlet_id,
    bulan: dateObj.toISOString().split('T')[0],
    nominal: data.nominal,
    bukti_url: data.bukti_url,
    catatan: data.catatan
  })
  
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/owner/kelola-mitra')
}

export async function balasSaran(data: { saran_id: string, tanggapan: string, user_id: string }) {
  const supabase = await getSupabase()
  
  // 1. Update database
  const { error } = await supabase.from('mitra_suggestions')
    .update({
      tanggapan: data.tanggapan,
      status: 'ditanggapi',
      updated_at: new Date().toISOString()
    })
    .eq('id', data.saran_id)
    
  if (error) throw new Error(error.message)
  
  // 2. Send push notification to the user
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: 'Saran Anda Ditanggapi',
          body: 'Admin telah memberikan tanggapan untuk saran/pertanyaan Anda.',
          url: '/dashboard/mitra',
          user_id: data.user_id // targeted to this specific user
        })
      })
      if (!res.ok) console.error('Failed to send push notification')
    }
  } catch (err) {
    console.error('Push notification error:', err)
  }
  
  revalidatePath('/dashboard/owner/kelola-mitra')
}

export async function deleteMitraTransfer(id: string, buktiUrl?: string) {
  const supabase = await getSupabase()

  if (buktiUrl) {
    const { error: storageError } = await supabase.storage
      .from('mitra-transfers')
      .remove([buktiUrl])
      
    if (storageError) {
      console.error('Failed to delete file from storage:', storageError.message)
    }
  }

  const { error } = await supabase
    .from('mitra_transfers')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/owner/kelola-mitra')
  revalidatePath('/dashboard/mitra/transfer')
}

