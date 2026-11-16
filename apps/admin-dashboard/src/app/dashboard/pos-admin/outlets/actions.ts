'use server'

import { createSupabaseServerClient } from '@suka/auth'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { cekHapusOutlet, cekPerubahanOutlet } from '@/lib/outlets/aturanEdit'
import {
  nonaktifkanOutletDiOrderOnline,
  sinkronOutletKeOrderOnline,
} from '@/lib/outlets/orderOnlineSync'

const SELECT_OUTLET_RINGKAS =
  'id, slug, name, address, lat, lng, phone, type, status, is_active, open_hour, close_hour, inactive_reason'

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
        .from('outlets').select('status, type, name').eq('id', outletData.id).single()
      if (errLama) throw errLama
      const ditolak = cekPerubahanOutlet(lama, { status, type: outletData.type ?? lama.type })
      if (ditolak) return { success: false, error: ditolak }

      const { data, error } = await supabase
        .from('outlets')
        .update(payload)
        .eq('id', outletData.id)
        .select(SELECT_OUTLET_RINGKAS)
        .single()

      if (error) throw error

      await sinkronOutletKeOrderOnline(
        {
          id: data.id,
          slug: data.slug,
          name: data.name,
          address: data.address ?? null,
          lat: data.lat ?? null,
          lng: data.lng ?? null,
          phone: data.phone ?? null,
          type: data.type,
          status: data.status,
          is_active: data.is_active,
          open_hour: data.open_hour ?? '14:00',
          close_hour: data.close_hour ?? '22:00',
        },
        {
          mode: 'ubah',
          tipeSebelumnya: lama?.type ?? null,
          namaSebelumnya: lama?.name ?? null,
        },
      )

      revalidatePath('/dashboard/pos-admin/outlets')
      revalidatePath('/dashboard/outlets')
      return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('outlets')
        .insert(payload)
        .select(SELECT_OUTLET_RINGKAS)
        .single()

      if (error) throw error

      try {
        await sinkronOutletKeOrderOnline(
          {
            id: data.id,
            slug: data.slug,
            name: data.name,
            address: data.address ?? null,
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            phone: data.phone ?? null,
            type: data.type,
            status: data.status,
            is_active: data.is_active,
            open_hour: data.open_hour ?? '14:00',
            close_hour: data.close_hour ?? '22:00',
          },
          { mode: 'buat' },
        )
      } catch (syncErr: any) {
        await supabase.from('outlets').delete().eq('id', data.id)
        throw new Error(`Gagal sinkronisasi Form Order: ${syncErr.message}`)
      }

      revalidatePath('/dashboard/pos-admin/outlets')
      revalidatePath('/dashboard/outlets')
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

    try {
      await nonaktifkanOutletDiOrderOnline(id)
    } catch (syncErr) {
      console.warn('Gagal menonaktifkan outlet di Form Order:', syncErr)
    }

    revalidatePath('/dashboard/pos-admin/outlets')
    revalidatePath('/dashboard/outlets')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting outlet:', error)
    return { success: false, error: error.message || 'Gagal menonaktifkan outlet' }
  }
}
