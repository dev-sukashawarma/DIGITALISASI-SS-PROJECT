'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function savePanduan(data: {
  system_code: string;
  title: string;
  content_html: string;
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
          system_code: data.system_code,
          title: data.title,
          content_html: data.content_html,
          updated_at: new Date().toISOString(),
          created_by: data.userId,
        },
        { onConflict: 'system_code' }
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
