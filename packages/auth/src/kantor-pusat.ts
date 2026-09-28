import type { AppName, Role } from './types'

/** ID tetap outlet Kantor Pusat (dibuat migrasi add_kantor_pusat_outlet). */
export const ID_KANTOR_PUSAT = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

/**
 * Staf yang bertugas di Kantor Pusat hanya memakai app ini — tidak ada kasir, stok, maupun
 * distribusi di sana. Hanya role yang tercantum yang dibatasi; developer, HR, finance,
 * purchasing, AM, dst. yang kebetulan tercatat di Kantor Pusat tetap memakai matriks biasa.
 * staff_pusat tetap membuka marcom (tim marketing bekerja di sana).
 *
 * Cermin `StaffProfile.hanyaAbsensiDanChat` di app native (di sana: Absensi + Chat).
 */
export const APP_TERBATAS_KANTOR_PUSAT: Partial<Record<Role, readonly AppName[]>> = {
  staff_pusat: ['absensi', 'marcom'],
  crew: ['absensi'],
}

export type LokasiStaff = { outlet_id?: string | null; outlets?: { name: string } | null } | null | undefined

/**
 * Staf yang outletnya Kantor Pusat. `outlet_id` di profil sudah outlet efektif (outlet absen
 * hari ini untuk staf BKO), dan submit_attendance memindahkan outlet utama ke tempat absen
 * masuk. Nama dipakai sebagai cadangan; Gudang Pusat ("GUDANG PUSAT (HQ)") tidak cocok.
 */
export function staffDiKantorPusat(staff: LokasiStaff): boolean {
  if (!staff) return false
  return staff.outlet_id === ID_KANTOR_PUSAT || /^kantor\s+pusat$/i.test(staff.outlets?.name?.trim() ?? '')
}

/** Daftar app terbatas bila [role] sedang di Kantor Pusat, atau null bila tidak dibatasi. */
export function appTerbatasKantorPusat(role: Role, lokasi: LokasiStaff): readonly AppName[] | null {
  const batas = APP_TERBATAS_KANTOR_PUSAT[role]
  if (!batas || !staffDiKantorPusat(lokasi)) return null
  return batas
}
