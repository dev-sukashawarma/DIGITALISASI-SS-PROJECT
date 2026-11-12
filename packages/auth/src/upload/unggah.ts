/**
 * Unggah file dari browser langsung ke Supabase Storage (lihat aturan.ts).
 *
 * Alur:
 *   1. normalisasiFile  — foto apa pun → JPEG rapi (diputar sesuai EXIF,
 *      diperkecil, dikompres sampai muat batas). PDF dilewatkan apa adanya.
 *   2. mintaLink        — Server Action milik app: cek peran user lalu
 *      kembalikan signed upload URL (pakai `buatLinkUnggah` di server).
 *   3. uploadToSignedUrl langsung ke Supabase, dicoba ulang bila jaringan putus.
 *
 * File tidak pernah melewati server aplikasi → tidak kena WAF Cloudflare dan
 * tidak kena batas body Server Action 1 MB.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adalahGambar,
  adalahHeic,
  adalahPdf,
  BATAS_UNGGAH_BAWAAN,
  buatPathUnggah,
  ekstensiDariTipe,
  hitungDimensi,
  layakDicobaUlang,
  NORMALISASI_BAWAAN,
  rencanaKompres,
  UKURAN_MENTAH_MAKS,
  validasiUnggahan,
  type BatasUnggah,
  type OpsiNormalisasi,
} from './aturan'

export class GalatUnggah extends Error {
  constructor(pesan: string) {
    super(pesan)
    this.name = 'GalatUnggah'
  }
}

type Sumber = { lebar: number; tinggi: number; gambar: CanvasImageSource; tutup: () => void }

async function bacaGambar(file: Blob): Promise<Sumber> {
  // createImageBitmap memutar foto sesuai EXIF (foto HP tidak miring).
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { lebar: bmp.width, tinggi: bmp.height, gambar: bmp, tutup: () => bmp.close() }
    } catch {
      /* jatuh ke <img> di bawah */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { lebar: img.naturalWidth, tinggi: img.naturalHeight, gambar: img, tutup: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

function keJpeg(src: Sumber, lebar: number, tinggi: number, kualitas: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = lebar
  canvas.height = tinggi
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  // Latar putih: PNG transparan tidak berubah jadi hitam saat jadi JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, lebar, tinggi)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src.gambar, 0, 0, lebar, tinggi)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', kualitas))
}

function namaJpeg(nama: string): string {
  const dasar = nama.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'foto'
  return `${dasar}.jpg`
}

/**
 * Ubah foto apa pun jadi JPEG yang muat `ukuranMaks`. PDF dikembalikan apa adanya.
 * Melempar `GalatUnggah` dengan pesan yang bisa langsung ditampilkan ke user.
 */
export async function normalisasiFile(file: File, opsi: OpsiNormalisasi = {}): Promise<File> {
  if (adalahPdf(file.type, file.name)) return file
  if (!adalahGambar(file.type, file.name)) {
    throw new GalatUnggah('Format file tidak didukung. Unggah foto (JPG, PNG, WEBP, HEIC) atau PDF.')
  }
  if (file.size > UKURAN_MENTAH_MAKS) {
    throw new GalatUnggah('Foto terlalu besar (lebih dari 40 MB). Kirim ulang foto dengan ukuran lebih kecil.')
  }
  const o = { ...NORMALISASI_BAWAAN, ...opsi }

  let src: Sumber
  try {
    src = await bacaGambar(file)
  } catch {
    if (adalahHeic(file.type, file.name)) {
      throw new GalatUnggah(
        'Foto HEIC (iPhone) tidak bisa dibaca browser ini. Kirim fotonya lewat WhatsApp dulu lalu unggah hasilnya, atau buka dari Safari.',
      )
    }
    throw new GalatUnggah('Foto tidak bisa dibaca (file rusak atau format tidak dikenal). Coba foto ulang.')
  }

  try {
    let terkecil: Blob | null = null
    for (const langkah of rencanaKompres(o)) {
      const { lebar, tinggi } = hitungDimensi(src.lebar, src.tinggi, Math.min(langkah.sisiMaks, o.sisiMaks))
      const blob = await keJpeg(src, lebar, tinggi, langkah.kualitas)
      if (!blob) continue
      if (!terkecil || blob.size < terkecil.size) terkecil = blob
      if (blob.size <= o.ukuranMaks) break
    }
    // JPEG asli yang sudah kecil & muat batas dipakai apa adanya (proses ulang
    // tidak membuatnya lebih kecil, hanya menurunkan kualitas).
    const jpegAsli = /^image\/(jpe?g|pjpeg)$/i.test(file.type) || (!file.type && /\.jpe?g$/i.test(file.name))
    const dimensiAman = Math.max(src.lebar, src.tinggi) <= o.sisiMaks
    if (jpegAsli && dimensiAman && file.size <= o.ukuranMaks && (!terkecil || file.size <= terkecil.size)) {
      return new File([file], namaJpeg(file.name), { type: 'image/jpeg', lastModified: file.lastModified })
    }
    if (!terkecil) throw new GalatUnggah('Browser gagal memproses foto. Coba lagi atau pakai browser lain.')
    if (terkecil.size > o.ukuranMaks) {
      throw new GalatUnggah('Foto tidak bisa dikecilkan sampai batas yang diizinkan. Coba foto ulang dengan resolusi lebih kecil.')
    }
    return new File([terkecil], namaJpeg(file.name), { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    src.tutup()
  }
}

export type LinkUnggah =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; pesan: string }

export type PermintaanLink = { namaFile: string; tipe: string; ukuran: number }

export type HasilUnggah = { url: string; path: string; tipe: string; ukuran: number }

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms))

function sudahAda(galat: unknown): boolean {
  const g = galat as { statusCode?: string | number; status?: number; message?: string }
  return String(g?.statusCode ?? g?.status) === '409' || /already exists|duplicate/i.test(g?.message ?? '')
}

/**
 * Normalisasi → minta signed URL → unggah langsung ke Storage (dengan retry).
 *
 * @param mintaLink Server Action app yang memeriksa peran lalu memanggil `buatLinkUnggah`.
 */
export async function unggahLangsung(p: {
  supabase: Pick<SupabaseClient, 'storage'>
  bucket: string
  file: File
  mintaLink: (req: PermintaanLink) => Promise<LinkUnggah>
  normalisasi?: OpsiNormalisasi
  batas?: BatasUnggah
  percobaan?: number
  /** Untuk test: ganti normalisasi. */
  _normalisasi?: (f: File, o: OpsiNormalisasi) => Promise<File>
}): Promise<HasilUnggah> {
  const batas = p.batas ?? BATAS_UNGGAH_BAWAAN
  const siap = await (p._normalisasi ?? normalisasiFile)(p.file, {
    ...p.normalisasi,
    ukuranMaks: Math.min(p.normalisasi?.ukuranMaks ?? NORMALISASI_BAWAAN.ukuranMaks, batas.ukuranMaks),
  })
  const tipe = siap.type || (adalahPdf(null, siap.name) ? 'application/pdf' : 'image/jpeg')
  const galat = validasiUnggahan({ tipe, ukuran: siap.size, nama: siap.name }, batas)
  if (galat) throw new GalatUnggah(galat)

  let link: LinkUnggah
  try {
    link = await p.mintaLink({ namaFile: siap.name, tipe, ukuran: siap.size })
  } catch {
    throw new GalatUnggah('Gagal menyiapkan unggahan. Periksa koneksi lalu coba lagi, atau muat ulang halaman.')
  }
  if (!link.ok) throw new GalatUnggah(link.pesan)

  const maks = Math.max(1, p.percobaan ?? 3)
  for (let ke = 1; ke <= maks; ke++) {
    try {
      const { error } = await p.supabase.storage
        .from(p.bucket)
        .uploadToSignedUrl(link.path, link.token, siap, { contentType: tipe, upsert: false })
      // 409 = percobaan sebelumnya sebenarnya sudah masuk, hanya balasannya hilang.
      if (!error || sudahAda(error)) return { url: link.publicUrl, path: link.path, tipe, ukuran: siap.size }
      if (ke === maks || !layakDicobaUlang(error)) {
        throw new GalatUnggah(`Gagal mengunggah file: ${(error as { message?: string }).message ?? 'galat storage'}`)
      }
    } catch (e) {
      if (e instanceof GalatUnggah) throw e
      if (ke === maks || !layakDicobaUlang(e)) {
        throw new GalatUnggah('Gagal mengunggah file karena koneksi terputus. Coba lagi.')
      }
    }
    await tunggu(600 * ke)
  }
  throw new GalatUnggah('Gagal mengunggah file. Coba lagi.')
}

/**
 * Varian untuk bucket yang SUDAH mengizinkan user login mengunggah (policy INSERT
 * authenticated, mis. `finance-proofs`): normalisasi + unggah dengan sesi user +
 * retry, tanpa Server Action. Mengembalikan path di bucket.
 */
export async function unggahDenganSesi(p: {
  supabase: Pick<SupabaseClient, 'storage'>
  bucket: string
  folder: string
  file: File
  normalisasi?: OpsiNormalisasi
  batas?: BatasUnggah
  percobaan?: number
  _normalisasi?: (f: File, o: OpsiNormalisasi) => Promise<File>
}): Promise<HasilUnggah> {
  const batas = p.batas ?? BATAS_UNGGAH_BAWAAN
  const siap = await (p._normalisasi ?? normalisasiFile)(p.file, {
    ...p.normalisasi,
    ukuranMaks: Math.min(p.normalisasi?.ukuranMaks ?? NORMALISASI_BAWAAN.ukuranMaks, batas.ukuranMaks),
  })
  const tipe = siap.type || (adalahPdf(null, siap.name) ? 'application/pdf' : 'image/jpeg')
  const galat = validasiUnggahan({ tipe, ukuran: siap.size, nama: siap.name }, batas)
  if (galat) throw new GalatUnggah(galat)

  const path = buatPathUnggah({ folder: p.folder, ekstensi: ekstensiDariTipe(tipe, siap.name) })
  const maks = Math.max(1, p.percobaan ?? 3)
  for (let ke = 1; ke <= maks; ke++) {
    try {
      const { error } = await p.supabase.storage.from(p.bucket).upload(path, siap, { contentType: tipe, upsert: false })
      if (!error || sudahAda(error)) {
        const { data } = p.supabase.storage.from(p.bucket).getPublicUrl(path)
        return { url: data.publicUrl, path, tipe, ukuran: siap.size }
      }
      if (ke === maks || !layakDicobaUlang(error)) {
        throw new GalatUnggah(`Gagal mengunggah file: ${(error as { message?: string }).message ?? 'galat storage'}`)
      }
    } catch (e) {
      if (e instanceof GalatUnggah) throw e
      if (ke === maks || !layakDicobaUlang(e)) {
        throw new GalatUnggah('Gagal mengunggah file karena koneksi terputus. Coba lagi.')
      }
    }
    await tunggu(600 * ke)
  }
  throw new GalatUnggah('Gagal mengunggah file. Coba lagi.')
}

/**
 * Sisi server: validasi lalu buat signed upload URL. Panggil dari Server Action
 * SETELAH memeriksa peran user; `supabase` = klien service role.
 */
export async function buatLinkUnggah(p: {
  supabase: Pick<SupabaseClient, 'storage'>
  bucket: string
  folder: string
  permintaan: PermintaanLink
  batas?: BatasUnggah
}): Promise<LinkUnggah> {
  const { namaFile, tipe, ukuran } = p.permintaan ?? ({} as PermintaanLink)
  const galat = validasiUnggahan({ tipe, ukuran: Number(ukuran), nama: namaFile }, p.batas ?? BATAS_UNGGAH_BAWAAN)
  if (galat) return { ok: false, pesan: galat }

  const path = buatPathUnggah({ folder: p.folder, ekstensi: ekstensiDariTipe(tipe, namaFile) })
  const { data, error } = await p.supabase.storage.from(p.bucket).createSignedUploadUrl(path)
  if (error || !data?.token) {
    return { ok: false, pesan: `Gagal menyiapkan unggahan: ${error?.message ?? 'token kosong'}` }
  }
  const { data: pub } = p.supabase.storage.from(p.bucket).getPublicUrl(path)
  return { ok: true, path: data.path ?? path, token: data.token, publicUrl: pub.publicUrl }
}
