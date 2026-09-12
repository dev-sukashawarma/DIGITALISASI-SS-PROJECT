// Kompresi gambar banner di sisi browser, sebelum diunggah ke bucket.
//
// Sebabnya nyata: banner "tester" pertama yang diunggah berukuran 5,2 MB untuk
// popup selebar layar HP. Pelanggan mengunduhnya tiap kali popup tampil, di
// jaringan outlet.
//
// Aturan yang dipegang modul ini:
//   1. TIDAK PERNAH melempar. Apa pun yang gagal -> kembalikan berkas asli.
//      Kompresi adalah penghematan, bukan syarat. Lebih baik unggah 5 MB
//      daripada admin tak bisa mengunggah sama sekali.
//   2. TIDAK PERNAH mengunggah hasil yang lebih besar dari aslinya.
//   3. GIF & SVG dilewati. Menggambar ulang GIF ke canvas membuang animasinya;
//      SVG kehilangan sifat vektornya.
//   4. Berkas yang sudah kecil DAN sudah cukup kecil dimensinya dilewati --
//      mengode ulang gambar yang sudah pas hanya menurunkan mutu tanpa
//      menghemat apa pun.

export const MAKS_SISI = 1280
export const MUTU = 0.82
export const BATAS_LEWATI_BYTE = 300 * 1024

/**
 * Skala turun agar sisi terpanjang tidak melebihi `maksSisi`, dengan rasio
 * dipertahankan. Gambar yang sudah lebih kecil dikembalikan apa adanya --
 * membesarkan gambar tidak menambah detail, hanya menambah byte.
 */
export function hitungDimensi(
  lebar: number,
  tinggi: number,
  maksSisi: number = MAKS_SISI,
): { lebar: number; tinggi: number } {
  if (!Number.isFinite(lebar) || !Number.isFinite(tinggi) || lebar <= 0 || tinggi <= 0) {
    return { lebar: 0, tinggi: 0 }
  }
  const sisiTerpanjang = Math.max(lebar, tinggi)
  if (sisiTerpanjang <= maksSisi) return { lebar: Math.round(lebar), tinggi: Math.round(tinggi) }
  const rasio = maksSisi / sisiTerpanjang
  // Minimal 1px: gambar sangat panjang-sempit (mis. 4000x1) tidak boleh
  // menghasilkan sisi 0, karena canvas berukuran 0 melempar.
  return {
    lebar: Math.max(1, Math.round(lebar * rasio)),
    tinggi: Math.max(1, Math.round(tinggi * rasio)),
  }
}

/** Format yang mengode ulangnya justru merusak. */
export function formatDilewati(tipe: string): boolean {
  const t = (tipe || '').toLowerCase()
  return t === 'image/gif' || t === 'image/svg+xml'
}

/**
 * Apakah berkas ini perlu diproses sama sekali. Dipisah dari kerja canvas-nya
 * supaya bisa diuji tanpa browser.
 */
export function perluDiproses(
  berkas: { type: string; size: number },
  batasByte: number = BATAS_LEWATI_BYTE,
): boolean {
  if (!berkas.type.startsWith('image/')) return false
  if (formatDilewati(berkas.type)) return false
  return berkas.size > batasByte
}

/** Ganti akhiran nama berkas mengikuti tipe hasil kompresi. */
export function namaHasil(namaAsal: string, tipeHasil: string): string {
  const akhiran = tipeHasil === 'image/webp' ? 'webp' : 'jpg'
  const tanpaAkhiran = namaAsal.replace(/\.[^.]+$/, '')
  return `${tanpaAkhiran || 'banner'}.${akhiran}`
}

function gambarKeBlob(
  kanvas: HTMLCanvasElement,
  tipe: string,
  mutu: number,
): Promise<Blob | null> {
  return new Promise((selesai) => {
    try {
      kanvas.toBlob((b) => selesai(b), tipe, mutu)
    } catch {
      selesai(null)
    }
  })
}

async function baca(berkas: File): Promise<{ lebar: number; tinggi: number; sumber: CanvasImageSource } | null> {
  // `imageOrientation: 'from-image'` WAJIB: foto dari HP menyimpan rotasi di
  // EXIF, dan canvas mengabaikannya kalau tidak diminta -- banner bisa
  // terunggah dalam keadaan terbaring.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(berkas, { imageOrientation: 'from-image' })
      return { lebar: bmp.width, tinggi: bmp.height, sumber: bmp }
    } catch {
      // jatuh ke jalur <img> di bawah
    }
  }
  return new Promise((selesai) => {
    const url = URL.createObjectURL(berkas)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      selesai({ lebar: img.naturalWidth, tinggi: img.naturalHeight, sumber: img })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      selesai(null)
    }
    img.src = url
  })
}

/**
 * Kembalikan versi terkompresi, atau berkas asli bila kompresi tidak berlaku
 * atau tidak menghemat apa pun. Tidak pernah melempar.
 */
export async function kompresGambarBanner(berkas: File): Promise<File> {
  try {
    if (!perluDiproses(berkas)) return berkas

    const dibaca = await baca(berkas)
    if (!dibaca) return berkas

    const { lebar, tinggi } = hitungDimensi(dibaca.lebar, dibaca.tinggi)
    if (lebar <= 0 || tinggi <= 0) return berkas

    const kanvas = document.createElement('canvas')
    kanvas.width = lebar
    kanvas.height = tinggi
    const ctx = kanvas.getContext('2d')
    if (!ctx) return berkas
    ctx.drawImage(dibaca.sumber, 0, 0, lebar, tinggi)

    // WebP lebih kecil DAN mempertahankan alpha, jadi PNG bertransparansi tak
    // berubah jadi kotak hitam. Kalau peramban tak mendukungnya, `toBlob`
    // diam-diam mengembalikan PNG -- itu sebabnya tipe hasilnya diperiksa,
    // bukan diasumsikan.
    let hasil = await gambarKeBlob(kanvas, 'image/webp', MUTU)
    if (!hasil || hasil.type !== 'image/webp') {
      hasil = await gambarKeBlob(kanvas, 'image/jpeg', MUTU)
    }
    if (!hasil || hasil.size === 0) return berkas

    // Aturan 2: jangan pernah memperbesar.
    if (hasil.size >= berkas.size) return berkas

    return new File([hasil], namaHasil(berkas.name, hasil.type), {
      type: hasil.type,
      lastModified: Date.now(),
    })
  } catch {
    return berkas
  }
}
