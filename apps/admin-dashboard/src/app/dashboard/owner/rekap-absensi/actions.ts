'use server'

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
const STATUS_MASUK = ['tepat', 'telat_toleransi', 'telat', 'alpha'] as const
const STATUS_PULANG = ['tepat', 'lebih_awal', 'pulang_telat'] as const

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
  statusMasuk: (typeof STATUS_MASUK)[number] | null
  /** null = hitung otomatis dari jam shift yang tercatat. */
  telatMenit: number | null
  jamPulang: string | null
  statusPulang: (typeof STATUS_PULANG)[number] | null
  menitPulang: number | null
  alasan: string
}

function pesanGalat(e: unknown): string {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  if (m.startsWith('Forbidden') || m.startsWith('Unauthorized')) {
    return 'Anda tidak punya akses untuk mengoreksi absensi.'
  }
  return m || 'Terjadi kesalahan'
}

function menitValid(v: number | null) {
  return v === null || (Number.isInteger(v) && v >= 0 && v <= 24 * 60)
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
    if (input.jamMasuk && !STATUS_MASUK.includes(input.statusMasuk as never)) {
      return { ok: false, pesan: 'Status masuk tidak dikenal' }
    }
    if (input.jamPulang && !STATUS_PULANG.includes(input.statusPulang as never)) {
      return { ok: false, pesan: 'Status pulang tidak dikenal' }
    }
    if (input.jamMasuk && input.jamPulang && input.jamPulang <= input.jamMasuk) {
      return { ok: false, pesan: 'Jam pulang harus setelah jam masuk' }
    }
    if (!menitValid(input.telatMenit) || !menitValid(input.menitPulang)) {
      return { ok: false, pesan: 'Menit harus bilangan bulat 0–1440' }
    }
    const alasan = input.alasan.trim()
    if (alasan.length < 3) return { ok: false, pesan: 'Alasan koreksi wajib diisi' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('koreksi_absensi', {
      p_staff_id: input.staffId,
      p_tanggal: input.tanggal,
      p_outlet_id: input.outletId,
      p_jam_masuk: input.jamMasuk,
      p_status_masuk: input.jamMasuk ? input.statusMasuk : null,
      p_telat_masuk: input.jamMasuk ? input.telatMenit : null,
      p_jam_pulang: input.jamPulang,
      p_status_pulang: input.jamPulang ? input.statusPulang : null,
      p_menit_pulang: input.jamPulang ? input.menitPulang : null,
      p_alasan: alasan,
    })
    if (error) return { ok: false, pesan: error.message }
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
    return { ok: true }
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) }
  }
}
