'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/authz'
import { createClient } from '@/lib/supabase/server'
import { createStaffSync } from '@/app/actions/users'
import { hapusOutletDiOrderOnline, sinkronOutletKeOrderOnline } from '@/lib/outlets/orderOnlineSync'
import { hariIniWib } from '@/lib/pembukaanOutlet/konstanta'
import { petakanStatusPersiapan } from '@/lib/pembukaanOutlet/petakan'
import { validasiInputWizard } from '@/lib/pembukaanOutlet/validasi'
import type { AkunMitraInput, HasilAksi, InputWizard, StatusPersiapan } from '@/lib/pembukaanOutlet/types'

// Semua tulis lewat RPC SECURITY DEFINER yang memeriksa role dari auth.uid(),
// jadi RPC WAJIB dipanggil dengan klien SESI pengguna, bukan service role
// (service role membuat auth.uid() NULL dan ditolak 42501). requireRole di sini
// adalah lapis pertama; database tetap penjaga terakhir.
const PERAN_TULIS = ['admin']
const PERAN_BACA = ['admin', 'owner']

function pesanGalat(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return 'Terjadi kesalahan'
}

const KOLOM_OUTLET = 'id, slug, name, address, lat, lng, type, is_active, open_hour, close_hour'

async function sinkronDariDb(outletId: string): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('outlets').select(KOLOM_OUTLET).eq('id', outletId).single()
  if (error) throw new Error(error.message)
  await sinkronOutletKeOrderOnline(data)
}

async function buatAkunMitra(outletId: string, akun: Extract<AkunMitraInput, { mode: 'baru' }>, namaMitra: string) {
  const hasil = await createStaffSync({
    name: akun.nama.trim() || namaMitra,
    username: akun.username.trim(),
    password: akun.password,
    role: 'mitra',
    outlet_id: outletId,
    outlet_ids: [outletId],
  })
  if (!hasil.ok || !hasil.staff_id) throw new Error(hasil.error || 'Gagal membuat akun mitra')
  return hasil.staff_id
}

async function tautkanMitra(outletId: string, userId: string, namaMitra: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('tautkan_akun_mitra_outlet', {
    p_outlet_id: outletId,
    p_user_id: userId,
    p_nama_mitra: namaMitra,
  })
  if (error) throw new Error(error.message)
}

export async function buatOutletBaru(input: InputWizard): Promise<HasilAksi<{ outletId: string }>> {
  try {
    await requireRole(PERAN_TULIS)
    const v = validasiInputWizard(input, hariIniWib())
    if (!v.ok) return { ok: false, pesan: Object.values(v.galat).join('. ') }

    const supabase = await createClient()
    const akunLama = input.mitra?.akun.mode === 'lama' ? input.mitra.akun.userId : null
    const { data: outletId, error } = await supabase.rpc('buat_outlet_persiapan', {
      p: {
        jenis: input.jenis,
        nama: input.nama.trim(),
        alamat: input.alamat,
        lat: input.lat,
        lng: input.lng,
        telepon: input.telepon,
        region: input.region,
        jam_buka: input.jamBuka,
        jam_tutup: input.jamTutup,
        tanggal_grand_opening: input.tanggalGrandOpening,
        am_staff_id: input.amStaffId,
        leader_staff_id: input.leaderStaffId,
        mitra: input.mitra && {
          nilai_investasi: input.mitra.nilaiInvestasi,
          persentase_bagi_hasil: input.mitra.persentaseBagiHasil,
          management_fee: input.mitra.managementFee,
          mitra_user_id: akunLama,
          nama_mitra: input.mitra.namaMitra,
        },
        rab: input.rab && {
          berlaku_sampai: input.rab.berlakuSampai,
          kategori_kecuali: input.rab.kategoriKecuali,
        },
      },
    })
    if (error) return { ok: false, pesan: error.message }
    const id = outletId as string

    // Order Online dulu, sebelum akun mitra: kalau gagal, outlet masih kosong
    // sehingga pembatalan benar-benar menghapusnya.
    try {
      await sinkronDariDb(id)
    } catch (e) {
      await supabase.rpc('batalkan_pembukaan_outlet', { p_outlet_id: id, p_alasan: 'Gagal sinkron Order Online' })
      return { ok: false, pesan: `Gagal sinkron ke Order Online: ${pesanGalat(e)}` }
    }

    let peringatan: string | undefined
    if (input.mitra?.akun.mode === 'baru') {
      try {
        const userId = await buatAkunMitra(id, input.mitra.akun, input.mitra.namaMitra)
        await tautkanMitra(id, userId, input.mitra.namaMitra)
      } catch (e) {
        peringatan = `Outlet dibuat, tetapi akun mitra gagal dibuat: ${pesanGalat(e)}. Buat ulang dari papan persiapan.`
      }
    }

    revalidatePath('/dashboard/pembukaan-outlet')
    return { ok: true, outletId: id, peringatan }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function ambilStatusPersiapan(outletId: string): Promise<StatusPersiapan> {
  await requireRole(PERAN_BACA)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('status_persiapan_outlet', { p_outlet_id: outletId })
  if (error) throw new Error(error.message)
  return petakanStatusPersiapan(data as Record<string, unknown>)
}

export async function ambilDaftarPersiapan(): Promise<StatusPersiapan[]> {
  await requireRole(PERAN_BACA)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('outlets')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const hasil = await Promise.all(
    (data ?? []).map(async o => {
      const { data: s, error: e } = await supabase.rpc('status_persiapan_outlet', { p_outlet_id: o.id })
      if (e) throw new Error(e.message)
      return petakanStatusPersiapan(s as Record<string, unknown>)
    }),
  )
  return hasil
}

export async function goLiveOutlet(
  outletId: string,
  konfirmasiNama: string,
  tanggal: string,
): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('go_live_outlet', {
      p_outlet_id: outletId,
      p_konfirmasi_nama: konfirmasiNama,
      p_tanggal: tanggal,
    })
    if (error) return { ok: false, pesan: error.message }

    let peringatan: string | undefined
    try {
      await sinkronDariDb(outletId)
    } catch (e) {
      peringatan = `Outlet sudah aktif, tetapi Order Online belum ikut aktif: ${pesanGalat(e)}`
    }
    revalidatePath('/dashboard/pembukaan-outlet')
    revalidatePath('/dashboard/outlets')
    return { ok: true, peringatan }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function batalkanPembukaan(
  outletId: string,
  alasan: string,
): Promise<HasilAksi<{ aksi: 'dihapus' | 'dinonaktifkan'; sisa: { jenis: string; jumlah: number }[] }>> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('batalkan_pembukaan_outlet', {
      p_outlet_id: outletId,
      p_alasan: alasan,
    })
    if (error) return { ok: false, pesan: error.message }
    const hasil = data as { aksi: 'dihapus' | 'dinonaktifkan'; sisa: { jenis: string; jumlah: number }[] }

    let peringatan: string | undefined
    try {
      if (hasil.aksi === 'dihapus') await hapusOutletDiOrderOnline(outletId)
    } catch (e) {
      peringatan = `Outlet terhapus, tetapi baris di Order Online gagal dihapus: ${pesanGalat(e)}`
    }
    revalidatePath('/dashboard/pembukaan-outlet')
    return { ok: true, aksi: hasil.aksi, sisa: hasil.sisa ?? [], peringatan }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function simpanMasaRab(
  outletId: string,
  berlakuSampai: string,
  kategoriKecuali: string[],
): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('simpan_masa_rab_outlet', {
      p_outlet_id: outletId,
      p_berlaku_sampai: berlakuSampai,
      p_kategori_kecuali: kategoriKecuali,
    })
    if (error) return { ok: false, pesan: error.message }
    revalidatePath(`/dashboard/pembukaan-outlet/${outletId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function simpanTanggalGrandOpening(outletId: string, tanggal: string): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const supabase = await createClient()
    const { error } = await supabase.rpc('simpan_tanggal_grand_opening', {
      p_outlet_id: outletId,
      p_tanggal: tanggal,
    })
    if (error) return { ok: false, pesan: error.message }
    revalidatePath('/dashboard/pembukaan-outlet')
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function buatAkunMitraSusulan(
  outletId: string,
  akun: AkunMitraInput,
  namaMitra: string,
): Promise<HasilAksi> {
  try {
    await requireRole(PERAN_TULIS)
    const userId = akun.mode === 'baru' ? await buatAkunMitra(outletId, akun, namaMitra) : akun.userId
    await tautkanMitra(outletId, userId, namaMitra)
    revalidatePath(`/dashboard/pembukaan-outlet/${outletId}`)
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}
