'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function savePanduan(data: {
  id: string;
  system_code: string;
  title: string;
  content_html: string;
  image_url?: string | null;
  userId: string;
}) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verifikasi peran admin
    const { data: userRole } = await supabaseAdmin
      .from('outlet_staff')
      .select('role')
      .eq('id', data.userId)
      .single()

    if (!userRole || !['admin', 'admin_hr', 'owner'].includes(userRole.role)) {
      return { error: 'Gagal menyimpan panduan. Pastikan Anda memiliki akses Admin/Owner.' }
    }

    const { error } = await supabaseAdmin
      .from('system_guides')
      .upsert(
        {
          id: data.id,
          system_code: data.system_code,
          title: data.title,
          content_html: data.content_html,
          image_url: data.image_url,
          updated_at: new Date().toISOString(),
          created_by: data.userId,
        },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('Save error:', error)
      return { error: 'Gagal menyimpan panduan ke database.' }
    }

    return { success: true }
  } catch (err: any) {
    console.error(err)
    return { error: 'Terjadi kesalahan server.' }
  }
}

export async function createPanduan(data: {
  system_code: string;
  title: string;
  userId: string;
}) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verifikasi peran admin
    const { data: userRole } = await supabaseAdmin
      .from('outlet_staff')
      .select('role')
      .eq('id', data.userId)
      .single()

    if (!userRole || !['admin', 'admin_hr', 'owner'].includes(userRole.role)) {
      return { error: 'Akses ditolak.' }
    }

    const { data: newGuide, error } = await supabaseAdmin
      .from('system_guides')
      .insert({
        system_code: data.system_code,
        title: data.title,
        content_html: '<p>Konten panduan baru...</p>',
        created_by: data.userId,
      })
      .select('id')
      .single()

    if (error) {
      return { error: 'Gagal membuat panduan.' }
    }

    return { success: true, id: newGuide.id }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan server.' }
  }
}

export async function deletePanduan(id: string, userId: string) {
  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verifikasi peran admin
    const { data: userRole } = await supabaseAdmin
      .from('outlet_staff')
      .select('role')
      .eq('id', userId)
      .single()

    if (!userRole || !['admin', 'admin_hr', 'owner'].includes(userRole.role)) {
      return { error: 'Akses ditolak.' }
    }

    const { error } = await supabaseAdmin
      .from('system_guides')
      .delete()
      .eq('id', id)

    if (error) {
      return { error: 'Gagal menghapus panduan.' }
    }

    return { success: true }
  } catch (err: any) {
    return { error: 'Terjadi kesalahan server.' }
  }
}
