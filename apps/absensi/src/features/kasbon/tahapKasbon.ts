/**
 * Tahap kasbon yang dilihat crew: persetujuan HR, lalu pencairan oleh finance.
 * `status_hr` = persetujuan HR; `status` = siklus uang (menunggu_cair → active → paid_off).
 */
export type NadaKasbon = 'menunggu' | 'proses' | 'sukses' | 'lunas' | 'tolak'

export function tahapKasbon(k: {
  status: string
  status_hr: string | null
  status_spv?: string | null
  dicairkan_at: string | null
  rejection_note: string | null
}): { label: string; nada: NadaKasbon; catatan: string | null } {
  if (k.status_hr === 'rejected' || k.status_spv === 'rejected') {
    const alasan = (k.rejection_note ?? '').replace(/^\[Ditolak Finance\]\s*/, '').trim()
    return { label: 'Ditolak', nada: 'tolak', catatan: alasan || null }
  }
  if (k.status === 'paid_off') return { label: 'Lunas', nada: 'lunas', catatan: null }
  if (k.status_hr !== 'approved') return { label: 'Menunggu persetujuan HR', nada: 'menunggu', catatan: null }
  if (k.status === 'menunggu_cair') return { label: 'Menunggu pencairan', nada: 'proses', catatan: null }
  const tanggal = k.dicairkan_at
    ? new Date(k.dicairkan_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' })
    : null
  return { label: 'Dicairkan', nada: 'sukses', catatan: tanggal ? `Dicairkan ${tanggal}` : null }
}
