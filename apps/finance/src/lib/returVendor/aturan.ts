/**
 * Aturan murni retur bahan baku ke vendor (Gudang Pusat).
 * DB (RPC *_retur_vendor) tetap penentu; fungsi di sini hanya untuk tampilan
 * dan harus mencerminkan retur_vendor_peran_ok() di migration 20261118110000.
 */

export const ALASAN_RETUR = ['rusak', 'kualitas_tidak_sesuai', 'salah_kirim', 'kadaluarsa', 'lainnya'] as const
export type AlasanRetur = (typeof ALASAN_RETUR)[number]

export const LABEL_ALASAN: Record<AlasanRetur, string> = {
  rusak: 'Rusak / cacat',
  kualitas_tidak_sesuai: 'Kualitas tidak sesuai',
  salah_kirim: 'Salah kirim',
  kadaluarsa: 'Kadaluarsa',
  lainnya: 'Lainnya',
}

export type StatusRetur = 'diajukan' | 'disetujui' | 'ditolak' | 'dibatalkan' | 'diserahkan' | 'selesai'

export const LABEL_STATUS: Record<StatusRetur, string> = {
  diajukan: 'Menunggu persetujuan',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
  diserahkan: 'Menunggu penyelesaian vendor',
  selesai: 'Selesai',
}

export type CaraPenyelesaian = 'ganti_barang' | 'potong_tagihan' | 'uang_kembali'

export const LABEL_CARA: Record<CaraPenyelesaian, string> = {
  ganti_barang: 'Ganti barang',
  potong_tagihan: 'Potong tagihan',
  uang_kembali: 'Uang kembali',
}

export type AksiRetur =
  | 'setujui'
  | 'tolak'
  | 'batal'
  | 'serahkan'
  | 'catat_penyelesaian'
  | 'konfirmasi_uang'
  | 'terima_pengganti'
  | 'tutup_sisa'

const PERAN = {
  ajukan: ['purchasing', 'kitchen', 'admin', 'owner', 'admin_finance', 'developer'],
  putus: ['admin', 'owner', 'admin_finance', 'developer'],
  serah: ['purchasing', 'kitchen', 'admin', 'owner', 'developer'],
  selesaikan: ['purchasing', 'admin', 'owner', 'admin_finance', 'developer'],
  uang: ['admin_finance', 'admin', 'owner', 'developer'],
} as const

const boleh = (lingkup: keyof typeof PERAN, peran: string) =>
  (PERAN[lingkup] as readonly string[]).includes(peran)

export const bolehAjukanRetur = (peran: string) => boleh('ajukan', peran)

export function sisaBisaDiretur(qtyTerima: number, qtyReturAktif: number): number {
  return Math.max(0, qtyTerima - qtyReturAktif)
}

export function totalRetur(items: { qty: number; harga: number }[]): number {
  return items.reduce((s, i) => s + i.qty * i.harga, 0)
}

export function aksiTersedia(
  status: StatusRetur,
  cara: CaraPenyelesaian | null,
  peran: string,
  adalahPengaju: boolean,
): AksiRetur[] {
  const aksi: AksiRetur[] = []
  if (status === 'diajukan' || status === 'disetujui') {
    if (status === 'diajukan' && boleh('putus', peran) && !adalahPengaju) aksi.push('setujui', 'tolak')
    if (status === 'disetujui' && boleh('serah', peran)) aksi.push('serahkan')
    if (boleh('putus', peran) || (adalahPengaju && boleh('ajukan', peran))) aksi.push('batal')
  }
  if (status === 'diserahkan') {
    if (cara === null && boleh('selesaikan', peran)) aksi.push('catat_penyelesaian')
    if (cara === 'uang_kembali' && boleh('uang', peran)) aksi.push('konfirmasi_uang')
    if (cara === 'ganti_barang' && boleh('serah', peran)) aksi.push('terima_pengganti')
    if (boleh('selesaikan', peran)) aksi.push('tutup_sisa')
  }
  return aksi
}

/** Kredit vendor yang dipakai bawaan saat mengajukan bayar: sebanyak saldo, maksimal tagihan. */
export function kreditBawaan(saldoKredit: number, totalTagihan: number): number {
  return Math.max(0, Math.min(saldoKredit, totalTagihan))
}
