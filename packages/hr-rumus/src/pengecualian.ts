/** Alasan seseorang TIDAK dihitung alpa/belum hadir pada suatu tanggal. Satu sumber untuk semua pembaca. */
export type JenisPengecualian = 'cuti' | 'libur'
export type Pengecualian = { jenis: JenisPengecualian; keterangan: string }

/** Label jenis cuti (sama dengan layar Perizinan HR). Hanya label — alasan pengajuan tak pernah dipakai. */
export const LABEL_CUTI: Record<string, string> = {
  annual: 'Cuti Tahunan',
  sick: 'Sakit',
  personal: 'Izin Pribadi',
  maternity: 'Cuti Melahirkan',
  other: 'Izin Lainnya',
}

export function petaPengecualian(input: {
  tanggal: string
  staf: { id: string; role: string }[]
  cutiDisetujui: { staff_id: string; leave_type: string; start_date: string; end_date: string }[]
  hariKerja: boolean
  namaHariLibur?: string | null
  roleLiburKantor: string[]
  /** id staf yang Off di Shift Roster pada tanggal itu */
  rosterOff: ReadonlySet<string>
}): Map<string, Pengecualian> {
  const cutiPer = new Map<string, string>()
  for (const c of input.cutiDisetujui) {
    if (c.start_date <= input.tanggal && c.end_date >= input.tanggal && !cutiPer.has(c.staff_id)) {
      cutiPer.set(c.staff_id, LABEL_CUTI[c.leave_type] ?? 'Cuti')
    }
  }
  const hasil = new Map<string, Pengecualian>()
  for (const s of input.staf) {
    const cuti = cutiPer.get(s.id)
    if (cuti) hasil.set(s.id, { jenis: 'cuti', keterangan: cuti })
    else if (input.rosterOff.has(s.id)) hasil.set(s.id, { jenis: 'libur', keterangan: 'Off (roster)' })
    else if (!input.hariKerja && input.roleLiburKantor.includes(s.role)) hasil.set(s.id, { jenis: 'libur', keterangan: input.namaHariLibur || 'Hari libur' })
  }
  return hasil
}
