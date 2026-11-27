'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/authz'

/**
 * Koreksi & hapus absensi dari Rekap Absensi (Stealth).
 *
 * Tulisannya lewat RPC `koreksi_absensi` / `hapus_absensi` (migration
 * 20260929100000) dengan sesi user sendiri — BUKAN service-role. RPC-nya
 * SECURITY DEFINER dan memeriksa peran di dalam database, jadi jejak audit
 * `attendance_koreksi.dilakukan_oleh` = auth.uid() yang tak bisa dipalsukan,
 * dan masuk/pulang diubah dalam satu transaksi. requireRole di sini hanya
 * penolakan dini dengan pesan ramah; gerbang sebenarnya di RPC.
 */

const PERAN_KOREKSI = ['owner', 'admin', 'admin_hr']

const RE_TANGGAL = /^\d{4}-\d{2}-\d{2}$/
const RE_JAM = /^([01]\d|2[0-3]):[0-5]\d$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type HasilKoreksi = { ok: true } | { ok: false; pesan: string }

export interface KoreksiAbsensiInput {
  staffId: string
  tanggal: string
  /** Dipakai hanya bila sisi masuk/pulang belum ada dan akan dibuat baru. */
  outletId: string | null
  jamMasuk: string | null
  /**
   * Status & menit dihitung database dari jam (shift tercatat / config outlet +
   * toleransi) — lihat hitung_status_absen. Keputusan manual: Alfa atau bebasTelat.
   */
  alfa: boolean
  /** Hilangkan label terlambat & denda telat menjadi Hadir tepat waktu (wajib catatanIzin). */
  bebasTelat?: boolean
  catatanIzin?: string | null
  jamPulang: string | null
  alasan: string
}

export interface AturanJamAbsensi {
  jamMasuk: string
  jamKeluar: string
  toleransiMenit: number
}

/** Jam kerja & toleransi outlet (config outlet → global), untuk pratinjau status di modal. */
export async function ambilAturanJamAbsensi(
  outletId: string
): Promise<{ ok: true; aturan: AturanJamAbsensi } | { ok: false; pesan: string }> {
  try {
    await requireRole(PERAN_KOREKSI)
    if (!RE_UUID.test(outletId)) return { ok: false, pesan: 'Outlet tidak valid' }
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('aturan_jam_absen', { p_outlet_id: outletId })
    if (error) return { ok: false, pesan: error.message }
    const r = (Array.isArray(data) ? data[0] : data) as
      | { jam_masuk: string | null; jam_keluar: string | null; toleransi_menit: number | null }
      | undefined
    return {
      ok: true,
      aturan: {
        jamMasuk: (r?.jam_masuk ?? '09:00').slice(0, 5),
        jamKeluar: (r?.jam_keluar ?? '17:00').slice(0, 5),
        toleransiMenit: Number(r?.toleransi_menit ?? 0),
      },
    }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

function pesanGalat(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  if (m.startsWith('Forbidden') || m.startsWith('Unauthorized')) {
    return 'Anda tidak punya akses untuk mengoreksi absensi.'
  }
  return m || 'Terjadi kesalahan'
}

export async function koreksiAbsensi(input: KoreksiAbsensiInput): Promise<HasilKoreksi> {
  try {
    await requireRole(PERAN_KOREKSI)

    if (!RE_UUID.test(input.staffId) || !RE_TANGGAL.test(input.tanggal)) {
      return { ok: false, pesan: 'Data baris absensi tidak valid' }
    }
    if (input.outletId !== null && !RE_UUID.test(input.outletId)) {
      return { ok: false, pesan: 'Outlet tidak valid' }
    }
    if (input.jamMasuk !== null && !RE_JAM.test(input.jamMasuk)) {
      return { ok: false, pesan: 'Format jam masuk harus JJ:MM' }
    }
    if (input.jamPulang !== null && !RE_JAM.test(input.jamPulang)) {
      return { ok: false, pesan: 'Format jam pulang harus JJ:MM' }
    }
    if (!input.jamMasuk && !input.jamPulang) {
      return { ok: false, pesan: 'Jam masuk dan pulang tidak boleh kosong keduanya — gunakan Hapus' }
    }
    if (input.jamMasuk && input.jamPulang && input.jamPulang <= input.jamMasuk) {
      return { ok: false, pesan: 'Jam pulang harus setelah jam masuk' }
    }
    const bebasTelat = Boolean(input.jamMasuk && input.bebasTelat && !input.alfa)
    const catatanIzin = (input.catatanIzin ?? '').trim()
    if (bebasTelat && catatanIzin.length < 3) {
      return { ok: false, pesan: 'Catatan izin wajib diisi (minimal 3 karakter) untuk menghilangkan label telat' }
    }
    const alasanInput = input.alasan.trim()
    const alasan = alasanInput.length >= 3 ? alasanInput : (bebasTelat ? `Hilangkan label telat: ${catatanIzin}` : alasanInput)
    if (alasan.length < 3) return { ok: false, pesan: 'Alasan koreksi wajib diisi' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('koreksi_absensi_v2', {
      p_staff_id: input.staffId,
      p_tanggal: input.tanggal,
      p_outlet_id: input.outletId,
      p_jam_masuk: input.jamMasuk,
      // null = dihitung database (migration 20261003110000).
      p_status_masuk: input.jamMasuk && input.alfa ? 'alpha' : null,
      p_telat_masuk: null,
      p_jam_pulang: input.jamPulang,
      p_status_pulang: null,
      p_menit_pulang: null,
      p_alasan: alasan,
      p_bebas_telat: bebasTelat,
      p_catatan: bebasTelat ? catatanIzin : null,
    })
    if (error) return { ok: false, pesan: error.message }
    revalidatePath('/dashboard/owner/rekap-absensi')
    revalidatePath('/dashboard/hr/attendance')
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}

export async function hapusAbsensi(input: {
  staffId: string
  tanggal: string
  alasan: string
}): Promise<HasilKoreksi> {
  try {
    await requireRole(PERAN_KOREKSI)

    if (!RE_UUID.test(input.staffId) || !RE_TANGGAL.test(input.tanggal)) {
      return { ok: false, pesan: 'Data baris absensi tidak valid' }
    }
    const alasan = input.alasan.trim()
    if (alasan.length < 3) return { ok: false, pesan: 'Alasan penghapusan wajib diisi' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('hapus_absensi', {
      p_staff_id: input.staffId,
      p_tanggal: input.tanggal,
      p_alasan: alasan,
    })
    if (error) return { ok: false, pesan: error.message }
    revalidatePath('/dashboard/owner/rekap-absensi')
    revalidatePath('/dashboard/hr/attendance')
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}
