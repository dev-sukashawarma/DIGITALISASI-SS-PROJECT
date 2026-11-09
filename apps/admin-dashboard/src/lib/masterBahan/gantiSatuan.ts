/**
 * Ganti Satuan bahan baku — fungsi murni untuk modal di panel detail bahan.
 * Rumus faktor HARUS sama dengan _rencana_ganti_satuan (migration 20261109103441):
 *   kKecil = jembatan (satuan kecil BARU per 1 satuan kecil LAMA)
 *   kBesar = faktor_tampilan_lama × jembatan ÷ faktor_tampilan_baru
 * Server tetap sumber kebenaran; fungsi ini hanya untuk pratinjau seketika di layar.
 */

export type SaldoPratinjau = {
  outlet_id: string
  outlet: string
  skala: 'besar' | 'kecil'
  saldo_lama: number
  saldo_baru: number
}

export type PenghalangGanti = { jenis: string; id?: string; nomor: string; outlet: string | null }

export type SatuanRingkas = {
  satuan: string
  satuan_tengah: string | null
  faktor_tengah: number | null
  satuan_kecil: string | null
  faktor_tampilan: number | null
  satuan_po: string | null
  satuan_distribusi: string | null
}

/** Bentuk JSON dari RPC pratinjau_ganti_satuan (snake_case sama persis dengan server). */
export type PratinjauGantiSatuan = {
  faktor_tampilan_lama: number
  faktor_tampilan_baru: number
  jembatan: number
  k_kecil: number
  k_besar: number
  satuan_lama: SatuanRingkas
  satuan_baru: SatuanRingkas
  peringatan_label: string[]
  penghalang: PenghalangGanti[]
  saldo: SaldoPratinjau[]
  jumlah: Record<string, number>
  harga_master_lama: number | null
  harga_master_baru: number | null
  /** Baris ledger bahan ini 15 menit terakhir — >0 berarti stok sedang bergerak (review I1). */
  aktivitas_15_menit?: number
}

const positif = (n: number) => Number.isFinite(n) && n > 0

export function faktorGanti(
  lamaTampilan: number,
  baruTampilan: number,
  jembatan: number,
): { kKecil: number; kBesar: number } | null {
  if (!positif(lamaTampilan) || !positif(baruTampilan) || !positif(jembatan)) return null
  return { kKecil: jembatan, kBesar: (lamaTampilan * jembatan) / baruTampilan }
}

export function kalimatJembatan(kecilLama: string, kecilBaru: string, jembatan: number): string {
  const angka = jembatan.toLocaleString('id-ID', { maximumFractionDigits: 6 })
  return `1 ${kecilLama} lama = ${angka} ${kecilBaru} baru`
}

const NAMA_JENIS: Record<string, string> = {
  opname_draft: 'Draft opname',
  surat_jalan: 'Surat jalan',
  purchase_order: 'PO',
  permintaan: 'Permintaan bahan',
  terima_vendor: 'Terima vendor (belum disahkan)',
  waste: 'Laporan waste menunggu',
  mutasi: 'Mutasi antar outlet',
  retur: 'Retur',
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Tanggal dari nomor buatan server ("Opname 2026-08-20" / "Permintaan 08/11/2026") → "20 Agu 2026". */
function tanggalDariNomor(nomor: string): string | null {
  const iso = nomor.match(/(\d{4})-(\d{2})-(\d{2})/)
  const dmy = nomor.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  const [t, b, h] = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : []
  if (!t || !b || !h) return null
  const bulan = BULAN[Number(b) - 1]
  return bulan ? `${Number(h)} ${bulan} ${t}` : null
}

export function labelPenghalang(p: { jenis: string; nomor: string; outlet: string | null }): string {
  if (p.jenis === 'substitusi') return 'Dipakai sebagai pasangan substitusi (waterfall)'
  const nama = NAMA_JENIS[p.jenis] ?? p.jenis
  // Nomor buatan server untuk jenis ini hanya "<jenis> <tanggal>" — tampilkan tanggalnya saja.
  const hanyaTanggal = p.jenis === 'opname_draft' || p.jenis === 'permintaan' || p.jenis === 'terima_vendor'
    || p.jenis === 'waste'
  const tanggal = hanyaTanggal ? tanggalDariNomor(p.nomor) : null
  const nomor = hanyaTanggal ? (tanggal ? ` ${tanggal}` : '') : p.jenis === 'mutasi' ? '' : ` ${p.nomor}`
  return `${nama}${nomor}${p.outlet ? ` · ${p.outlet}` : ''}`
}
