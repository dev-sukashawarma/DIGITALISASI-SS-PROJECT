'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { sinkronOutletKeOrderOnline } from '@/lib/outlets/orderOnlineSync'
import { petakanStatusPenutupan } from '@/lib/penutupanOutlet/petakan'
import type { HasilAksi, KunciManual, StatusPenutupan } from '@/lib/penutupanOutlet/types'

// Semua tulis lewat RPC SECURITY DEFINER yang memeriksa role dari auth.uid(),
// jadi RPC WAJIB dipanggil dengan klien SESI, bukan service role (auth.uid()
// NULL → 42501). requireRole adalah lapis pertama; database penjaga terakhir.
// JANGAN me-re-export tipe dari berkas ini ('use server' menjadikannya nilai runtime).
const PERAN_TULIS = ['admin']
const PERAN_BACA = ['admin', 'owner']
const PERAN_CENTANG = ['admin', 'owner', 'admin_finance']

const KOLOM_OUTLET = 'id, slug, name, address, lat, lng, type, is_active, open_hour, close_hour'

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Terjadi kesalahan'
}

function segarkan(outletId: string) {
  revalidatePath('/dashboard/penutupan-outlet')
  revalidatePath(`/dashboard/penutupan-outlet/${outletId}`)
  revalidatePath('/dashboard/outlets')
}

/** Order Online mengikuti status outlet di DB (is_active dibaca ulang). */
async function sinkronDariDb(outletId: string): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('outlets').select(KOLOM_OUTLET).eq('id', outletId).single()
  if (error) throw new Error(error.message)
  await sinkronOutletKeOrderOnline(data)
}

export async function ambilStatusPenutupan(outletId: string): Promise<StatusPenutupan> {
  await requireRole(PERAN_BACA)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('status_penutupan_outlet', { p_outlet_id: outletId })
  if (error) throw new Error(error.message)
  return petakanStatusPenutupan(data as Record<string, unknown>)
}

/** Outlet yang ditutup tapi pembersihannya belum ditandai selesai. */
export async function ambilDaftarPenutupan(): Promise<StatusPenutupan[]> {
  await requireRole(PERAN_BACA)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('outlets')
    .select('id')
    .eq('status', 'inactive')
    .not('alasan_tutup', 'is', null)
    .is('penutupan_selesai_at', null)
    .order('nonaktif_at', { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all(
    (data ?? []).map(async o => {
      const { data: s, error: e } = await supabase.rpc('status_penutupan_outlet', { p_outlet_id: o.id })
      if (e) throw new Error(e.message)
      return petakanStatusPenutupan(s as Record<string, unknown>)
    }),
  )
}

/** Angka untuk tab "Penutupan" (tanpa memanggil checklist per outlet). */
export async function hitungPenutupanTerbuka(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('outlets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'inactive')
    .not('alasan_tutup', 'is', null)
    .is('penutupan_selesai_at', null)
  return count ?? 0
}

export async function tutupOutlet(input: {
  outletId: string
  tanggalTerakhir: string
  alasan: string
}): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('tutup_outlet', {
      p_outlet_id: input.outletId,
      p_tanggal_terakhir: input.tanggalTerakhir,
      p_alasan: input.alasan,
    })
    if (error) return { ok: false, pesan: error.message }

    let peringatan: string | undefined
    try {
      await sinkronDariDb(input.outletId)
      const { error: errCentang } = await supabase.rpc('centang_langkah_penutupan', {
        p_outlet_id: input.outletId,
        p_kunci: 'kanal_online',
        p_catatan: 'Otomatis: aplikasi & Order Online dimatikan saat tutup',
        p_batal: false,
      })
      if (errCentang) throw new Error(errCentang.message)
    } catch (e) {
      peringatan = `Order Online gagal dimatikan (${pesanGalat(e)}) — cek manual lalu centang di papan`
    }
    segarkan(input.outletId)
    return { ok: true, peringatan }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function bukaKembaliOutlet(outletId: string, alasan: string): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('buka_kembali_outlet', { p_outlet_id: outletId, p_alasan: alasan })
    if (error) return { ok: false, pesan: error.message }
    let peringatan: string | undefined
    try {
      await sinkronDariDb(outletId)
    } catch (e) {
      peringatan = `Order Online gagal diperbarui (${pesanGalat(e)})`
    }
    segarkan(outletId)
    return { ok: true, peringatan }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function koreksiTanggalTutup(outletId: string, tanggal: string, alasan: string): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('koreksi_tanggal_tutup', {
      p_outlet_id: outletId,
      p_tanggal: tanggal,
      p_alasan: alasan,
    })
    if (error) return { ok: false, pesan: error.message }
    segarkan(outletId)
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function nolkanSisaStok(
  outletId: string,
  alasan: string,
): Promise<HasilAksi<{ jumlahBahan: number; nilai: number }>> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('nolkan_sisa_stok_outlet', { p_outlet_id: outletId, p_alasan: alasan })
    if (error) return { ok: false, pesan: error.message }
    const hasil = data as { jumlah_bahan: number; nilai: number }
    segarkan(outletId)
    return { ok: true, jumlahBahan: Number(hasil.jumlah_bahan), nilai: Number(hasil.nilai) }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function centangLangkah(
  outletId: string,
  kunci: KunciManual,
  catatan: string,
  batal = false,
): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_CENTANG)
    const supabase = await createClient()
    const { error } = await supabase.rpc('centang_langkah_penutupan', {
      p_outlet_id: outletId,
      p_kunci: kunci,
      p_catatan: catatan,
      p_batal: batal,
    })
    if (error) return { ok: false, pesan: error.message }
    segarkan(outletId)
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function tandaiPenutupanSelesai(outletId: string): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('tandai_penutupan_selesai', { p_outlet_id: outletId })
    if (error) return { ok: false, pesan: error.message }
    segarkan(outletId)
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}
