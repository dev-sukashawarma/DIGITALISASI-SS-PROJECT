import { tanggalWaktu } from '@/lib/format'
import { namaPencatat } from '@/lib/kas/mutasiRekening'

export type JenisRiwayat = 'petty_cash' | 'kasbon' | 'po' | 'bayar_vendor' | 'dana_kantor'
export type KeputusanRiwayat = 'setuju' | 'tolak' | 'serah_am' | 'batal_cair'

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

export const URUTAN_JENIS_RIWAYAT: JenisRiwayat[] = ['petty_cash', 'kasbon', 'po', 'bayar_vendor', 'dana_kantor']

export const LABEL_JENIS_RIWAYAT: Record<JenisRiwayat, string> = {
  petty_cash: 'Petty cash',
  kasbon: 'Kasbon',
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
        : r.keputusan === 'batal_cair'
          ? 'Pencairan dibatalkan'
          : r.jenis === 'dana_kantor'
            ? 'Diverifikasi'
            : r.jenis === 'kasbon'
              ? 'Dicairkan'
              : 'Disetujui'
  return { jenis: LABEL_JENIS_RIWAYAT[r.jenis], keputusan }
}

export function teksWaktuRiwayat(waktu: string | null): string {
  return waktu ? tanggalWaktu(waktu) : 'Jam tidak tercatat'
}

const ZONA = 'Asia/Jakarta'

function tanggalWib(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONA })
}

/** Jam keputusan (WIB), mis. "16.25". */
export function jamRiwayat(waktu: string): string {
  return new Date(waktu).toLocaleTimeString('id-ID', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
}

export interface GrupRiwayat {
  kunci: string
  label: string
  baris: RiwayatApproval[]
  total: number
}

/**
 * Kelompokkan riwayat per hari WIB (urutan masukan dipertahankan).
 * Keputusan lama tanpa jam masuk satu grup "tanpa-jam" — jamnya tidak dikarang.
 */
export function kelompokkanPerHari(baris: RiwayatApproval[], now: Date): GrupRiwayat[] {
  const hariIni = tanggalWib(now.toISOString())
  const kemarinDate = new Date(`${hariIni}T00:00:00+07:00`)
  kemarinDate.setUTCDate(kemarinDate.getUTCDate() - 1)
  const kemarin = tanggalWib(kemarinDate.toISOString())

  const grup: GrupRiwayat[] = []
  for (const r of baris) {
    const kunci = r.waktu ? tanggalWib(r.waktu) : 'tanpa-jam'
    let g = grup.find((x) => x.kunci === kunci)
    if (!g) {
      const label =
        kunci === 'tanpa-jam'
          ? 'Jam tidak tercatat'
          : kunci === hariIni
            ? 'Hari ini'
            : kunci === kemarin
              ? 'Kemarin'
              : new Date(`${kunci}T12:00:00+07:00`).toLocaleDateString('id-ID', {
                  timeZone: ZONA,
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
      g = { kunci, label, baris: [], total: 0 }
      grup.push(g)
    }
    g.baris.push(r)
    g.total += Number(r.nominal) || 0
  }
  return grup
}

/** Nama pelaku untuk tampilan; akun Superadmin 2 dipegang Hesti Qodriani (sama dengan halaman mutasi). */
export function namaPelakuRiwayat(nama: string | null | undefined): string | null {
  return namaPencatat(nama)
}
