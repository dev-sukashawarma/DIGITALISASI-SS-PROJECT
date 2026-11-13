/**
 * Peta outlet → nama Area Manager yang sedang bertugas, dibangun dari
 * `am_outlet_assignments` (tabel penugasan yang dikelola HR dan juga dibaca
 * fungsi SQL `get_monthly_am_bonus`). Dulu dashboard ini memakai
 * `staff_outlets` lalu jatuh ke daftar nama outlet yang ditulis di kode,
 * sehingga outlet baru tak pernah punya AM sampai kodenya diedit.
 */

export interface BarisPenugasanAm {
  outlet_id: string
  effective_from: string
  effective_to: string | null
  outlet_staff: { name: string | null; role: string; status: string } | null
}

/** Nama akun AM dummy/uji yang tidak boleh tampil sebagai AM sungguhan. */
export const isIgnoredAMStaffName = (name: string | null | undefined): boolean => {
  if (!name) return true
  const n = name.trim().toUpperCase()
  return (
    n.startsWith('AREA MANAGER') ||
    n.includes('TEST') ||
    n.includes('TES ') ||
    n === 'TES' ||
    n === 'ADMIN' ||
    n === 'DEVELOPER' ||
    n === 'LAINNYA' ||
    n === 'LAIN-LAIN' ||
    n === 'OTHER' ||
    n === 'OTHERS'
  )
}

/** `tanggal` = YYYY-MM-DD (WIB). Penugasan berlaku bila from <= tanggal <= to. */
export function petaAmAktif(baris: BarisPenugasanAm[], tanggal: string): Map<string, string> {
  const peta = new Map<string, string>()
  for (const b of baris) {
    if (b.effective_from > tanggal) continue
    if (b.effective_to !== null && b.effective_to < tanggal) continue
    const staf = b.outlet_staff
    if (!staf || staf.role !== 'area_manager' || staf.status !== 'active') continue
    const nama = (staf.name ?? '').trim()
    if (isIgnoredAMStaffName(nama)) continue
    peta.set(b.outlet_id, nama)
  }
  return peta
}
