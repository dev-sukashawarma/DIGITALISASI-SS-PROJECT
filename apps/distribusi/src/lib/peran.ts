// Satu sumber daftar peran untuk app distribusi.
// Driver sengaja BUKAN pusat: ia melihat semua SJ (read-only) tapi tidak
// membuat SJ, tidak memvalidasi, dan tidak memverifikasi penerimaan outlet.

type Peran = string | null | undefined

/** Tim pusat (gudang/manajemen) — tampilan & aksi pusat, termasuk buat SJ. */
export const PERAN_PUSAT = ['kitchen', 'admin', 'admin_hr', 'spv', 'regional_manager', 'owner', 'developer'] as const

/** Pengirim pusat: boleh aksi kirim/validasi SJ (pusat + purchasing). */
export const PERAN_PUSAT_SENDER = [...PERAN_PUSAT, 'purchasing'] as const

/** Boleh membuka halaman Pelacakan Driver. Harus sama dengan is_pelacak_driver() di DB. */
export const PERAN_PELACAK = ['kitchen', 'admin', 'purchasing', 'owner', 'developer'] as const

const ada = (daftar: readonly string[], role: Peran) => !!role && daftar.includes(role)

export const isDriver = (role: Peran) => role === 'driver'
export const isPusat = (role: Peran) => ada(PERAN_PUSAT, role)
export const isPusatSender = (role: Peran) => ada(PERAN_PUSAT_SENDER, role)
export const bisaBuatSj = (role: Peran) => isPusat(role)
/** Tampilan "semua outlet" (daftar & dashboard pusat). Driver ikut, tanpa aksi. */
export const bisaLihatSemuaSj = (role: Peran) => isPusat(role) || isDriver(role)
export const bisaLacakDriver = (role: Peran) => ada(PERAN_PELACAK, role)
