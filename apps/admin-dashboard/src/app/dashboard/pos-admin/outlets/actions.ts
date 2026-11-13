'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { cekHapusOutlet, cekPerubahanOutlet } from '@/lib/outlets/aturanEdit'

export async function upsertOutlet(outletData: any) {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const status = outletData.status || (outletData.is_active ? 'active' : 'pending')
    const payload = {
      ...outletData,
      status,
      is_active: status === 'active',
      updated_at: new Date().toISOString(),
    }

    if (outletData.id) {
      // Aturan yang sama dengan halaman Outlet: aktif↔nonaktif outlet internal/mitra
      // hanya lewat Tutup Outlet / Buka kembali (DB juga menahannya diam-diam).
      const { data: lama, error: errLama } = await supabase
        .from('outlets').select('status, type').eq('id', outletData.id).single()
      if (errLama) throw errLama
      const ditolak = cekPerubahanOutlet(lama, { status, type: outletData.type ?? lama.type })
      if (ditolak) return { success: false, error: ditolak }

      const { data, error } = await supabase
        .from('outlets')
        .update(payload)
        .eq('id', outletData.id)
        .select()
        .single()

      if (error) throw error
      revalidatePath('/dashboard/pos-admin/outlets')
      return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('outlets')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      revalidatePath('/dashboard/pos-admin/outlets')
      return { success: true, data }
    }
  } catch (error: any) {
    console.error('Error upserting outlet:', error)
    return { success: false, error: error.message || 'Gagal menyimpan outlet' }
  }
}

export async function deleteOutlet(id: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    const { data: lama, error: errLama } = await supabase
      .from('outlets').select('status, type').eq('id', id).single()
    if (errLama) throw errLama
    const ditolak = cekHapusOutlet(lama)
    if (ditolak) return { success: false, error: ditolak }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('outlets')
      .update({
        is_active: false,
        status: 'inactive',
        deleted_at: now,
        updated_at: now,
      })
      .eq('id', id)
    if (error) throw error

    revalidatePath('/dashboard/pos-admin/outlets')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting outlet:', error)
    return { success: false, error: error.message || 'Gagal menonaktifkan outlet' }
  }
}
