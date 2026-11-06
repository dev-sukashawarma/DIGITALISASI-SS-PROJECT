import { tanggalWaktu } from '@/lib/format'

export type JenisRiwayat = 'petty_cash' | 'po' | 'bayar_vendor' | 'dana_kantor'
export type KeputusanRiwayat = 'setuju' | 'tolak' | 'serah_am'

/** Satu baris riwayat keputusan (tabel approval_log + nama pelaku). */
export interface RiwayatApproval {
  id: string
  jenis: JenisRiwayat
  keputusan: KeputusanRiwayat
  sumber_id: string
  judul: string | null
  keterangan: string | null
  nominal: number | null
  alasan: string | null
  /** NULL = keputusan lama yang jamnya tidak tercatat. */
  waktu: string | null
  waktu_urut: string
  dari_data_lama: boolean
  pelaku_nama: string | null
}

export const URUTAN_JENIS_RIWAYAT: JenisRiwayat[] = ['petty_cash', 'po', 'bayar_vendor', 'dana_kantor']

export const LABEL_JENIS_RIWAYAT: Record<JenisRiwayat, string> = {
  petty_cash: 'Petty cash',
  po: 'Approval PO',
  bayar_vendor: 'Bayar vendor',
  dana_kantor: 'Dana kantor',
}

export function labelRiwayat(r: Pick<RiwayatApproval, 'jenis' | 'keputusan'>): { jenis: string; keputusan: string } {
  const keputusan =
    r.keputusan === 'tolak'
      ? 'Ditolak'
      : r.keputusan === 'serah_am'
        ? 'Diserahkan ke AM'
        : r.jenis === 'dana_kantor'
          ? 'Diverifikasi'
          : 'Disetujui'
  return { jenis: LABEL_JENIS_RIWAYAT[r.jenis], keputusan }
}

export function teksWaktuRiwayat(waktu: string | null): string {
  return waktu ? tanggalWaktu(waktu) : 'Jam tidak tercatat'
}
