/**
 * Aturan unggah file bersama untuk semua app SUKA.
 *
 * Latar (12 Nov 2026): foto nota OPEX gagal diunggah ("An unexpected response
 * was received from the server") karena file dikirim lewat Server Action →
 * Cloudflare/aplikasi. Mulai sekarang file TIDAK lagi lewat server aplikasi:
 * server hanya memberi signed upload URL, browser mengunggah langsung ke
 * Supabase Storage. Foto dinormalkan dulu di browser (JPEG, diperkecil,
 * EXIF dibuang) supaya foto apa pun muat di batas bucket mana pun.
 *
 * File ini murni (tanpa DOM / tanpa Node API) — dipakai klien dan server.
 */

export const MB = 1024 * 1024

/** Tipe yang diterima dari user SEBELUM dinormalkan. */
export const TIPE_GAMBAR_MASUK = /^image\//i
export const TIPE_PDF = 'application/pdf'

export type OpsiNormalisasi = {
  /** Sisi terpanjang hasil (px). Default 1600 — nota tetap terbaca jelas. */
  sisiMaks?: number
  /** Ukuran maksimal hasil (byte). Default 1,5 MB. */
  ukuranMaks?: number
  /** Kualitas JPEG awal 0..1. Default 0.82. */
  kualitas?: number
}

export const NORMALISASI_BAWAAN: Required<OpsiNormalisasi> = {
  sisiMaks: 1600,
  ukuranMaks: 1.5 * MB,
  kualitas: 0.82,
}

/** Batas file mentah yang masih boleh DIPILIH user (sebelum dikompres). */
export const UKURAN_MENTAH_MAKS = 40 * MB

export type BatasUnggah = {
  /** Ukuran maksimal file yang diunggah ke storage (setelah normalisasi). */
  ukuranMaks: number
  /** Boleh PDF? */
  bolehPdf: boolean
}

export const BATAS_UNGGAH_BAWAAN: BatasUnggah = { ukuranMaks: 10 * MB, bolehPdf: true }

export function adalahPdf(tipe: string | null | undefined, nama?: string | null): boolean {
  if ((tipe ?? '').toLowerCase() === TIPE_PDF) return true
  return !tipe && /\.pdf$/i.test(nama ?? '')
}

/** HEIC/HEIF (foto iPhone) — banyak browser selain Safari tak bisa membacanya. */
export function adalahHeic(tipe: string | null | undefined, nama?: string | null): boolean {
  if (/image\/hei[cf]/i.test(tipe ?? '')) return true
  return /\.(heic|heif)$/i.test(nama ?? '')
}

export function adalahGambar(tipe: string | null | undefined, nama?: string | null): boolean {
  if (TIPE_GAMBAR_MASUK.test(tipe ?? '')) return true
  // Sebagian HP/browser mengirim tipe kosong — tebak dari ekstensi.
  return !tipe && /\.(jpe?g|jfif|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(nama ?? '')
}

/**
 * Hitung dimensi hasil: perkecil proporsional sampai sisi terpanjang ≤ sisiMaks.
 * Tidak pernah memperbesar.
 */
export function hitungDimensi(lebar: number, tinggi: number, sisiMaks: number): { lebar: number; tinggi: number } {
  if (!(lebar > 0) || !(tinggi > 0)) return { lebar: 1, tinggi: 1 }
  const terpanjang = Math.max(lebar, tinggi)
  if (terpanjang <= sisiMaks) return { lebar: Math.round(lebar), tinggi: Math.round(tinggi) }
  const skala = sisiMaks / terpanjang
  return { lebar: Math.max(1, Math.round(lebar * skala)), tinggi: Math.max(1, Math.round(tinggi * skala)) }
}

/**
 * Urutan percobaan kompres: turunkan kualitas dulu, baru perkecil dimensi.
 * Dijamin berhenti (daftar terbatas) — tidak ada loop tanpa akhir.
 */
export function rencanaKompres(opsi: Required<OpsiNormalisasi>): { sisiMaks: number; kualitas: number }[] {
  const langkah: { sisiMaks: number; kualitas: number }[] = []
  const kualitas = [opsi.kualitas, 0.7, 0.6, 0.5].filter((q, i, a) => q <= opsi.kualitas && a.indexOf(q) === i)
  for (const skala of [1, 0.75, 0.5, 0.35]) {
    const sisi = Math.max(320, Math.round(opsi.sisiMaks * skala))
    for (const q of kualitas) langkah.push({ sisiMaks: sisi, kualitas: q })
  }
  return langkah
}

/** Ekstensi aman untuk nama file di storage. */
export function ekstensiDariTipe(tipe: string | null | undefined, nama?: string | null): string {
  const t = (tipe ?? '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/pjpeg') return 'jpg'
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  if (t === TIPE_PDF) return 'pdf'
  if (/image\/hei[cf]/.test(t)) return 'heic'
  const dariNama = (nama ?? '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
  return dariNama && dariNama.length <= 5 ? dariNama : 'bin'
}

/** Folder aman: huruf kecil, angka, `-`, `_`, `/`; tanpa `..` atau garis miring di ujung. */
export function rapikanFolder(folder: string): string {
  return folder
    .toLowerCase()
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .map((s) => s.replace(/[^a-z0-9_-]/g, '-'))
    .join('/')
}

/** Path unik: `<folder>/<yyyy-mm>/<epoch>_<acak>.<ext>`. */
export function buatPathUnggah(p: { folder: string; ekstensi: string; sekarang?: Date; acak?: string }): string {
  const sekarang = p.sekarang ?? new Date()
  const bulan = `${sekarang.getUTCFullYear()}-${String(sekarang.getUTCMonth() + 1).padStart(2, '0')}`
  const acak =
    p.acak ??
    Array.from({ length: 8 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
  const folder = rapikanFolder(p.folder)
  const ext = p.ekstensi.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  return `${folder ? folder + '/' : ''}${bulan}/${sekarang.getTime()}_${acak}.${ext}`
}

/**
 * Validasi file yang AKAN diunggah ke storage (setelah normalisasi).
 * Mengembalikan pesan galat berbahasa Indonesia, atau null bila boleh.
 */
export function validasiUnggahan(
  f: { tipe: string | null | undefined; ukuran: number; nama?: string | null },
  batas: BatasUnggah = BATAS_UNGGAH_BAWAAN,
): string | null {
  if (!(f.ukuran > 0)) return 'File kosong atau rusak. Pilih ulang filenya.'
  const pdf = adalahPdf(f.tipe, f.nama)
  if (pdf && !batas.bolehPdf) return 'File PDF tidak diterima di sini. Unggah foto.'
  if (!pdf && !adalahGambar(f.tipe, f.nama)) return 'Format file tidak didukung. Unggah foto atau PDF.'
  if (f.ukuran > batas.ukuranMaks) {
    return `Ukuran file ${(f.ukuran / MB).toFixed(1)} MB melebihi batas ${(batas.ukuranMaks / MB).toFixed(0)} MB.`
  }
  return null
}

/** Galat jaringan/server sementara yang layak dicoba ulang. */
export function layakDicobaUlang(galat: unknown): boolean {
  if (!galat) return false
  const g = galat as { status?: number; statusCode?: number | string; message?: string; name?: string }
  const status = Number(g.status ?? g.statusCode)
  if (Number.isFinite(status) && status > 0) return status >= 500 || status === 408 || status === 429
  const pesan = `${g.name ?? ''} ${g.message ?? ''}`.toLowerCase()
  return /network|fetch|timeout|timed out|abort|econnreset|load failed|failed to fetch/.test(pesan)
}
