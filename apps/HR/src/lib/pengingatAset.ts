/**
 * Algoritma pengingat aset outlet (murni, tanpa I/O — lihat pengingatAset.test.ts).
 *
 * Sumber data: RPC `inventaris_pengingat_aset()` = laporan inventaris TERBARU
 * tiap outlet, hanya barang yang dilacak umurnya atau dilaporkan rusak/perlu
 * perbaikan, plus tindak lanjut HR terakhir per pemicu.
 *
 * Aturan:
 *  1. Barang yang tidak ada di outlet (kondisi "tidak_ada", jumlah 0, atau
 *     tidak tersedia) tidak dinilai sama sekali.
 *  2. Pemicu KONDISI: "rusak" / "perlu_perbaikan" → langsung perlu tindakan,
 *     berapa pun umurnya.
 *  3. Pemicu UMUR (bila jenis barang punya umur pakai):
 *       jatuh tempo = tanggal beli + umur pakai
 *       ambang     = min(90 hari, 25% umur pakai)
 *       lewat jatuh tempo → "Lewat umur";  sisa ≤ ambang → "Segera".
 *     Tanggal beli kosong → masuk daftar "Tanggal beli belum diisi".
 *  4. Tindak lanjut HR menyembunyikan pemicunya sampai `ingatkan_lagi`,
 *     SELAMA data acuannya sama (tanggal beli untuk umur, kondisi untuk
 *     kondisi). Begitu AM mengubah datanya, barang dinilai ulang dari nol.
 *       - "Sudah diganti" / "Sudah diperbaiki" → dicek ulang 30 hari lagi.
 *         Kalau AM belum memperbarui data (tanggal beli baru / kondisi baik),
 *         pengingat muncul lagi — jadi tidak ada yang hilang diam-diam.
 *       - "Tunda" → muncul lagi setelah jangka yang dipilih HR.
 */

export type Pemicu = 'umur' | 'kondisi'
export type Keputusan = 'diganti' | 'diperbaiki' | 'ditunda'
export type Alasan = 'rusak' | 'lewat_umur' | 'perbaikan' | 'segera'
export type Kategori = 'perlu_tindakan' | 'ditindaklanjuti' | 'tanggal_kosong' | 'aman' | 'tidak_dilacak'

export type BarisPengingat = {
  outlet_id: string
  outlet_name: string | null
  master_item_id: string
  item_name: string | null
  subsection: string | null
  umur_ekonomis_bulan: number | null
  purchase_date: string | null
  kondisi: string | null
  observed_qty: number | string | null
  is_present: boolean | null
  brand: string | null
  catatan: string | null
  dilaporkan_oleh: string | null
  dilaporkan_at: string | null
  /** Area Manager yang dihubungi HR (pelapor, atau AM binaan yang bernomor). */
  kontak_nama?: string | null
  kontak_hp?: string | null
  /** Foto bukti dari laporan inventaris terakhir (bucket `inventaris-foto`). */
  photo_path?: string | null
  tl_umur_keputusan: string | null
  tl_umur_ingatkan_lagi: string | null
  tl_umur_acuan_tanggal: string | null
  tl_umur_catatan: string | null
  tl_umur_oleh: string | null
  tl_umur_at: string | null
  tl_kondisi_keputusan: string | null
  tl_kondisi_ingatkan_lagi: string | null
  tl_kondisi_acuan: string | null
  tl_kondisi_catatan: string | null
  tl_kondisi_oleh: string | null
  tl_kondisi_at: string | null
}

export type TindakLanjutAktif = {
  pemicu: Pemicu
  alasan: Alasan
  keputusan: Keputusan
  ingatkanLagi: string
  catatan: string | null
  oleh: string | null
  at: string | null
}

export type AsetPengingat = {
  key: string
  outletId: string
  outletName: string
  masterItemId: string
  itemName: string
  subsection: string
  brand: string | null
  catatanAm: string | null
  kondisi: string
  purchaseDate: string | null
  umurBulan: number | null
  jatuhTempo: string | null
  sisaHari: number | null
  tanggalKosong: boolean
  dilaporkanOleh: string | null
  dilaporkanAt: string | null
  kontakNama: string | null
  kontakHp: string | null
  fotoPath: string | null
  /** Alasan yang masih menunggu tindakan HR. */
  alasan: Alasan[]
  /** Alasan yang sedang disembunyikan oleh tindak lanjut HR. */
  ditindaklanjuti: TindakLanjutAktif[]
  kategori: Kategori
  prioritas: number
}

export const AMBANG_MAKS_HARI = 90
export const CEK_ULANG_SETELAH_SELESAI_HARI = 30

export const PILIHAN_TUNDA: { hari: number; label: string }[] = [
  { hari: 14, label: '2 minggu' },
  { hari: 30, label: '1 bulan' },
  { hari: 90, label: '3 bulan' },
  { hari: 180, label: '6 bulan' },
]

const URUTAN_ALASAN: Record<Alasan, number> = { rusak: 0, lewat_umur: 1, perbaikan: 2, segera: 3 }
const PEMICU_ALASAN: Record<Alasan, Pemicu> = { rusak: 'kondisi', perbaikan: 'kondisi', lewat_umur: 'umur', segera: 'umur' }

/* ---------------- tanggal (string yyyy-MM-dd, dihitung di UTC) ---------------- */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function keUtc(iso: string): number | null {
  const m = ISO.exec(iso.slice(0, 10))
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function dariUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Tambah bulan; tanggal dijepit ke akhir bulan (31 Jan + 1 bln = 28/29 Feb). */
export function tambahBulan(iso: string, bulan: number): string | null {
  const m = ISO.exec(iso.slice(0, 10))
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1 + bulan
  const d = Number(m[3])
  const akhirBulan = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
  return dariUtc(Date.UTC(y, mo, Math.min(d, akhirBulan)))
}

export function tambahHari(iso: string, hari: number): string {
  const ms = keUtc(iso)
  if (ms === null) throw new Error(`Tanggal tidak valid: ${iso}`)
  return dariUtc(ms + hari * 86_400_000)
}

export function selisihHari(dari: string, ke: string): number | null {
  const a = keUtc(dari)
  const b = keUtc(ke)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000)
}

export function ambangHari(umurBulan: number): number {
  return Math.min(AMBANG_MAKS_HARI, Math.floor(umurBulan * 30 * 0.25))
}

/* ---------------- penilaian ---------------- */

function punyaUnit(row: BarisPengingat): boolean {
  if (row.kondisi === 'tidak_ada') return false
  if (row.is_present === false) return false
  if (row.observed_qty !== null && row.observed_qty !== '' && Number(row.observed_qty) === 0) return false
  return true
}

function tindakLanjut(row: BarisPengingat, pemicu: Pemicu, alasan: Alasan, today: string): TindakLanjutAktif | null {
  const umur = pemicu === 'umur'
  const keputusan = (umur ? row.tl_umur_keputusan : row.tl_kondisi_keputusan) as Keputusan | null
  const ingatkanLagi = umur ? row.tl_umur_ingatkan_lagi : row.tl_kondisi_ingatkan_lagi
  if (!keputusan || !ingatkanLagi) return null
  // Data acuan berubah → catatan lama tidak berlaku.
  const acuanSama = umur
    ? (row.tl_umur_acuan_tanggal ?? null) === (row.purchase_date ?? null)
    : (row.tl_kondisi_acuan ?? null) === (row.kondisi ?? null)
  if (!acuanSama) return null
  if (today >= ingatkanLagi.slice(0, 10)) return null
  return {
    pemicu,
    alasan,
    keputusan,
    ingatkanLagi: ingatkanLagi.slice(0, 10),
    catatan: umur ? row.tl_umur_catatan : row.tl_kondisi_catatan,
    oleh: umur ? row.tl_umur_oleh : row.tl_kondisi_oleh,
    at: umur ? row.tl_umur_at : row.tl_kondisi_at,
  }
}

export function nilaiAset(row: BarisPengingat, today: string): AsetPengingat {
  const umurBulan = row.umur_ekonomis_bulan ?? null
  const kondisi = row.kondisi ?? ''
  const ada = punyaUnit(row)

  const pemicuAktif: Alasan[] = []
  if (ada && kondisi === 'rusak') pemicuAktif.push('rusak')
  if (ada && kondisi === 'perlu_perbaikan') pemicuAktif.push('perbaikan')

  let jatuhTempo: string | null = null
  let sisaHari: number | null = null
  let tanggalKosong = false
  if (ada && umurBulan) {
    if (!row.purchase_date) {
      tanggalKosong = true
    } else {
      jatuhTempo = tambahBulan(row.purchase_date, umurBulan)
      sisaHari = jatuhTempo ? selisihHari(today, jatuhTempo) : null
      if (sisaHari !== null) {
        if (sisaHari < 0) pemicuAktif.push('lewat_umur')
        else if (sisaHari <= ambangHari(umurBulan)) pemicuAktif.push('segera')
      }
    }
  }

  const alasan: Alasan[] = []
  const ditindaklanjuti: TindakLanjutAktif[] = []
  for (const a of pemicuAktif) {
    const tl = tindakLanjut(row, PEMICU_ALASAN[a], a, today)
    if (tl) ditindaklanjuti.push(tl)
    else alasan.push(a)
  }
  alasan.sort((a, b) => URUTAN_ALASAN[a] - URUTAN_ALASAN[b])

  const kategori: Kategori = alasan.length > 0
    ? 'perlu_tindakan'
    : ditindaklanjuti.length > 0
      ? 'ditindaklanjuti'
      : tanggalKosong
        ? 'tanggal_kosong'
        : ada && umurBulan
          ? 'aman'
          : 'tidak_dilacak'

  const semua = [...alasan, ...ditindaklanjuti.map((t) => t.alasan)]
  const prioritas = semua.length ? Math.min(...semua.map((a) => URUTAN_ALASAN[a])) : 9

  return {
    key: `${row.outlet_id}:${row.master_item_id}`,
    outletId: row.outlet_id,
    outletName: row.outlet_name ?? 'Outlet tanpa nama',
    masterItemId: row.master_item_id,
    itemName: row.item_name ?? 'Item inventaris',
    subsection: row.subsection ?? 'Lainnya',
    brand: row.brand,
    catatanAm: row.catatan,
    kondisi,
    purchaseDate: row.purchase_date,
    umurBulan,
    jatuhTempo,
    sisaHari,
    tanggalKosong,
    dilaporkanOleh: row.dilaporkan_oleh,
    dilaporkanAt: row.dilaporkan_at,
    kontakNama: row.kontak_nama ?? null,
    kontakHp: row.kontak_hp ?? null,
    fotoPath: row.photo_path?.trim() || null,
    alasan,
    ditindaklanjuti,
    kategori,
    prioritas,
  }
}

export type RingkasanPengingat = {
  aset: AsetPengingat[]
  perluTindakan: AsetPengingat[]
  ditindaklanjuti: AsetPengingat[]
  tanggalKosong: AsetPengingat[]
  hitung: Record<Alasan, number>
}

export function susunPengingat(rows: BarisPengingat[], today: string): RingkasanPengingat {
  const aset = rows.map((row) => nilaiAset(row, today))
  const urut = (a: AsetPengingat, b: AsetPengingat) =>
    a.prioritas - b.prioritas
    || (a.sisaHari ?? Number.MAX_SAFE_INTEGER) - (b.sisaHari ?? Number.MAX_SAFE_INTEGER)
    || a.outletName.localeCompare(b.outletName)
    || a.itemName.localeCompare(b.itemName)
  const perluTindakan = aset.filter((a) => a.kategori === 'perlu_tindakan').sort(urut)
  const hitung: Record<Alasan, number> = { rusak: 0, lewat_umur: 0, perbaikan: 0, segera: 0 }
  for (const a of perluTindakan) for (const al of a.alasan) hitung[al] += 1
  return {
    aset,
    perluTindakan,
    ditindaklanjuti: aset.filter((a) => a.kategori === 'ditindaklanjuti').sort(urut),
    tanggalKosong: aset
      .filter((a) => a.tanggalKosong && a.kategori !== 'ditindaklanjuti')
      .sort((a, b) => a.outletName.localeCompare(b.outletName) || a.itemName.localeCompare(b.itemName)),
    hitung,
  }
}

/* ---------------- membuat catatan tindak lanjut ---------------- */

export type TindakLanjutBaru = {
  outlet_id: string
  master_item_id: string
  pemicu: Pemicu
  keputusan: Keputusan
  catatan: string | null
  ingatkan_lagi: string
  acuan_tanggal_beli: string | null
  acuan_kondisi: string | null
  konfirmasi_wa: boolean
}

/**
 * Barang rusak / perlu perbaikan WAJIB melewati langkah konfirmasi ke Area
 * Manager (WhatsApp bila perlu) sebelum HR menyimpan keputusan. Pengingat yang
 * murni soal umur tidak perlu.
 */
export function perluKonfirmasi(aset: AsetPengingat): boolean {
  return aset.alasan.some((a) => a === 'rusak' || a === 'perbaikan')
}

/**
 * Satu keputusan HR berlaku untuk SEMUA pemicu aktif barang itu (mis. rusak
 * sekaligus lewat umur → dua baris, satu per pemicu, snapshot masing-masing).
 */
export function buatTindakLanjut(
  aset: AsetPengingat,
  keputusan: Keputusan,
  today: string,
  opsi: { tundaHari?: number; catatan?: string; konfirmasiWa?: boolean } = {}
): TindakLanjutBaru[] {
  const hari = keputusan === 'ditunda' ? (opsi.tundaHari ?? 30) : CEK_ULANG_SETELAH_SELESAI_HARI
  if (!(hari > 0)) throw new Error('Jangka tunda harus lebih dari 0 hari')
  const ingatkanLagi = tambahHari(today, hari)
  const catatan = opsi.catatan?.trim() ? opsi.catatan.trim().slice(0, 500) : null
  const pemicu = [...new Set(aset.alasan.map((a) => PEMICU_ALASAN[a]))]
  return pemicu.map((p) => ({
    outlet_id: aset.outletId,
    master_item_id: aset.masterItemId,
    pemicu: p,
    keputusan,
    catatan,
    ingatkan_lagi: ingatkanLagi,
    acuan_tanggal_beli: p === 'umur' ? aset.purchaseDate : null,
    acuan_kondisi: p === 'kondisi' ? aset.kondisi : null,
    konfirmasi_wa: Boolean(opsi.konfirmasiWa),
  }))
}

/** Batalkan tindak lanjut yang sedang aktif: pengingat langsung muncul lagi. */
export function batalkanTindakLanjut(aset: AsetPengingat, today: string): TindakLanjutBaru[] {
  return aset.ditindaklanjuti.map((t) => ({
    outlet_id: aset.outletId,
    master_item_id: aset.masterItemId,
    pemicu: t.pemicu,
    keputusan: 'ditunda' as const,
    catatan: 'Tindak lanjut dibatalkan',
    ingatkan_lagi: today,
    acuan_tanggal_beli: t.pemicu === 'umur' ? aset.purchaseDate : null,
    acuan_kondisi: t.pemicu === 'kondisi' ? aset.kondisi : null,
    konfirmasi_wa: false,
  }))
}

/* ---------------- label ---------------- */

export const LABEL_ALASAN: Record<Alasan, string> = {
  rusak: 'Rusak',
  lewat_umur: 'Lewat umur pakai',
  perbaikan: 'Perlu perbaikan',
  segera: 'Segera habis umur',
}

export const LABEL_KEPUTUSAN: Record<Keputusan, string> = {
  diganti: 'Sudah diganti',
  diperbaiki: 'Sudah diperbaiki',
  ditunda: 'Ditunda',
}

export function formatUmur(bulan: number | null): string {
  if (!bulan) return '-'
  if (bulan % 12 === 0) return `${bulan / 12} tahun`
  if (bulan < 12) return `${bulan} bulan`
  return `${Math.floor(bulan / 12)} th ${bulan % 12} bln`
}

export function formatSisa(sisaHari: number | null): string {
  if (sisaHari === null) return '-'
  if (sisaHari === 0) return 'habis hari ini'
  const n = Math.abs(sisaHari)
  const teks = n >= 60 ? `${Math.round(n / 30)} bulan` : `${n} hari`
  return sisaHari < 0 ? `lewat ${teks}` : `${teks} lagi`
}
