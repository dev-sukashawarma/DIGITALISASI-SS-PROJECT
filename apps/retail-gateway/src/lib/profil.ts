/**
 * Validasi & normalisasi ubahan profil pelanggan (nama, nomor WhatsApp).
 *
 * Email SENGAJA tidak bisa diubah lewat sini: itu identitas akun Google.
 *
 * Nomor disimpan dalam satu bentuk kanonik `628xxxx` -- bentuk yang dipakai
 * tautan wa.me -- supaya pencocokan & pengiriman pesan tidak bergantung pada
 * cara pelanggan mengetik (08…, +62…, 62…, berspasi, bertanda hubung).
 */

export const NAMA_MIN = 2
export const NAMA_MAKS = 60

export type HasilPeriksa<T> = { ok: true; nilai: T } | { ok: false; pesan: string }

/** Nomor HP Indonesia -> bentuk kanonik 628xxxx, atau null bila tidak wajar. */
export function normalisasiWhatsApp(masukan: string): string | null {
  const bersih = masukan.replace(/[\s\-().]/g, '')
  let angka: string
  if (bersih.startsWith('+62')) angka = '62' + bersih.slice(3)
  else if (bersih.startsWith('62')) angka = bersih
  else if (bersih.startsWith('0')) angka = '62' + bersih.slice(1)
  else return null
  // 62 + 8 + 7..12 digit, sama dengan batas nomorHpWajar di pesanan.
  return /^628\d{7,12}$/.test(angka) ? angka : null
}

export function periksaNama(masukan: unknown): HasilPeriksa<string> {
  if (typeof masukan !== 'string') return { ok: false, pesan: 'Nama tidak valid.' }
  const rapi = masukan.trim().replace(/\s+/g, ' ')
  if (rapi.length < NAMA_MIN) return { ok: false, pesan: `Nama minimal ${NAMA_MIN} huruf.` }
  if (rapi.length > NAMA_MAKS) return { ok: false, pesan: `Nama maksimal ${NAMA_MAKS} huruf.` }
  return { ok: true, nilai: rapi }
}

/**
 * Nomor kosong = hapus nomor (null). Selain itu wajib nomor HP Indonesia.
 */
export function periksaWhatsApp(masukan: unknown): HasilPeriksa<string | null> {
  if (masukan === null) return { ok: true, nilai: null }
  if (typeof masukan !== 'string') return { ok: false, pesan: 'Nomor WhatsApp tidak valid.' }
  if (masukan.trim() === '') return { ok: true, nilai: null }
  const kanonik = normalisasiWhatsApp(masukan)
  if (!kanonik) {
    return { ok: false, pesan: 'Nomor WhatsApp harus nomor HP Indonesia, mis. 0812 3456 7890.' }
  }
  return { ok: true, nilai: kanonik }
}
