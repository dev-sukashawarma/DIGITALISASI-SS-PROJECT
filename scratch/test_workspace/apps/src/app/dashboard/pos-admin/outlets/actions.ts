'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function upsertOutlet(outletData: any) {
  try {
    const cookieStore = await cookies()
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    })

    if (outletData.id) {
      const { data, error } = await supabase
        .from('outlets')
        .update(outletData)
        .eq('id', outletData.id)
        .select()
        .single()

      if (error) throw error
      revalidatePath('/dashboard/pos-admin/outlets')
      return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('outlets')
        .insert(outletData)
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

    const { error } = await supabase.from('outlets').delete().eq('id', id)
    if (error) throw error

    revalidatePath('/dashboard/pos-admin/outlets')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting outlet:', error)
    return { success: false, error: error.message || 'Gagal menghapus outlet' }
  }
}
