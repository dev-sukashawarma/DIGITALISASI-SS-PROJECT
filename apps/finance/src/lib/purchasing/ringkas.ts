/**
 * Navigasi ringkas purchasing: halaman yang dulu berdiri sendiri digabung jadi tab
 * per tahap alur kerja (Kebutuhan -> PO -> Tagihan -> Laporan), plus daftar Tugas Hari Ini.
 * Murni (tanpa React) supaya bisa diuji.
 */

export interface TabRute {
  href: string
  label: string
}

export const GRUP_TAB: TabRute[][] = [
  [
    { href: '/pembelian/perlu-dibeli', label: 'Usulan sistem' },
    { href: '/pembelian/permintaan', label: 'Permintaan cabang' },
  ],
  [
    { href: '/pembelian', label: 'Semua PO' },
    { href: '/po-approval', label: 'Approval' },
    { href: '/pembelian/penerimaan', label: 'Barang diterima' },
  ],
  [
    { href: '/supplier', label: 'Tagihan & pembayaran' },
    { href: '/pembelian/invoice', label: 'Cocokkan invoice' },
  ],
  [
    { href: '/pembelian/laporan', label: 'Realisasi PO' },
    { href: '/laporan/pembelian', label: 'Tren bulanan' },
    { href: '/pembelian/harga', label: 'Harga bahan' },
  ],
]

/** Tab untuk halaman ini, atau null bila halaman tidak termasuk grup mana pun (cocok persis). */
export function tabUntuk(pathname: string | null | undefined): TabRute[] | null {
  if (!pathname) return null
  const p = pathname.replace(/\/+$/, '') || '/'
  return GRUP_TAB.find((g) => g.some((t) => t.href === p)) ?? null
}

export type NadaTugas = 'aksi' | 'peringatan' | 'info'

export interface Tugas {
  kunci: string
  jumlah: number
  judul: string
  keterangan: string
  href: string
  nada: NadaTugas
}

export interface InputTugas {
  prMenunggu: number
  poDraft: number
  poMenungguApproval: number
  poTerlambat: number
  /** PO diterima & belum dibayar, belum ada invoice. */
  tanpaInvoice: number
  /** PO diterima & belum dibayar, invoice ada, belum pernah ditolak. */
  siapDiajukan: number
  /** Pengajuan bayar yang ditolak finance, belum diajukan ulang. */
  ditolakFinance: number
  /** Pengajuan bayar yang menunggu keputusan finance. */
  menungguFinance: number
}

/**
 * Daftar tugas berurutan: yang ditolak/terlambat lebih dulu, lalu pekerjaan, lalu info.
 * Tugas berjumlah nol disembunyikan; daftar kosong = semua beres.
 */
export function susunTugas(i: InputTugas): Tugas[] {
  const semua: Tugas[] = [
    { kunci: 'ditolak', jumlah: i.ditolakFinance, judul: 'Pengajuan bayar ditolak finance', keterangan: 'Perbaiki sesuai alasan, lalu ajukan ulang', href: '/supplier', nada: 'peringatan' },
    { kunci: 'terlambat', jumlah: i.poTerlambat, judul: 'PO lewat estimasi tiba', keterangan: 'Hubungi supplier, barang belum diterima', href: '/pembelian', nada: 'peringatan' },
    { kunci: 'pr', jumlah: i.prMenunggu, judul: 'Permintaan cabang belum dibuat PO', keterangan: 'Buat PO atau tolak permintaannya', href: '/pembelian/permintaan', nada: 'aksi' },
    { kunci: 'draft', jumlah: i.poDraft, judul: 'PO masih draft', keterangan: 'Lengkapi lalu ajukan approval', href: '/pembelian', nada: 'aksi' },
    { kunci: 'invoice', jumlah: i.tanpaInvoice, judul: 'Barang diterima, invoice belum diunggah', keterangan: 'Unggah invoice supplier agar bisa diajukan bayar', href: '/supplier', nada: 'aksi' },
    { kunci: 'ajukan', jumlah: i.siapDiajukan, judul: 'Tagihan siap diajukan', keterangan: 'Invoice lengkap, ajukan pembayaran ke finance', href: '/supplier', nada: 'aksi' },
    { kunci: 'approval', jumlah: i.poMenungguApproval, judul: 'PO menunggu approval finance', keterangan: 'Tidak perlu tindakan, tunggu keputusan', href: '/po-approval', nada: 'info' },
    { kunci: 'bayar', jumlah: i.menungguFinance, judul: 'Pembayaran menunggu finance', keterangan: 'Tidak perlu tindakan, tunggu keputusan', href: '/supplier', nada: 'info' },
  ]
  return semua.filter((t) => t.jumlah > 0)
}

/** Jumlah yang menuntut tindakan purchasing (untuk judul tab / badge), tanpa yang sekadar info. */
export function jumlahPerluTindakan(t: Tugas[]): number {
  return t.filter((x) => x.nada !== 'info').reduce((a, x) => a + x.jumlah, 0)
}
