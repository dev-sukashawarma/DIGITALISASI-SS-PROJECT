// Validasi form staff — fungsi MURNI (tanpa side-effect) agar bisa diuji unit.
// Komponen StaffForm yang menangani alert + pindah tab; di sini hanya keputusan.
//
// Konteks: StaffForm adalah wizard multi-step. Bug yang dicegah di sini: validasi
// per-step yang bisa di-bypass dengan lompat tab (mundur lalu klik tab jauh)
// sehingga NIK invalid lolos. validateStaffThrough memvalidasi SEMUA step
// 0..targetIndex, bukan hanya step aktif.

export type StaffStepId = 'utama' | 'pribadi' | 'darurat' | 'keuangan'

export interface StaffStepValues {
  name: string
  username: string
  password: string
  nik: string
  isEditing: boolean
}

/** Pesan error step (null bila valid). */
export function validateStaffStep(stepId: StaffStepId, v: StaffStepValues): string | null {
  if (stepId === 'utama') {
    if (!v.name) return 'Nama Lengkap wajib diisi'
    if (!v.username) return 'Username wajib diisi'
    if (!v.isEditing && !v.password) return 'Password Sementara wajib diisi'
  } else if (stepId === 'pribadi') {
    if (v.nik && v.nik.length !== 16) return 'NIK harus tepat 16 digit angka!'
  }
  return null
}

/**
 * Validasi semua step dari indeks 0 s/d targetIndex (inklusif).
 * Mengembalikan step pertama yang invalid + pesannya, atau null bila semua lolos.
 */
export function validateStaffThrough(
  steps: readonly StaffStepId[],
  targetIndex: number,
  v: StaffStepValues,
): { stepId: StaffStepId; message: string } | null {
  for (let i = 0; i <= targetIndex && i < steps.length; i++) {
    const message = validateStaffStep(steps[i], v)
    if (message) return { stepId: steps[i], message }
  }
  return null
}
