/**
 * Tautan WhatsApp (wa.me) untuk menghubungi Area Manager dari web HR.
 * Murni — lihat whatsapp.test.ts.
 */

/**
 * Nomor HP Indonesia → format internasional tanpa tanda plus (mis. 6281234567890),
 * sesuai format wa.me. Menerima "0812…", "+62 812-…", "62812…", "812…".
 * Kembalikan null bila bukan nomor yang masuk akal.
 */
export function nomorWa(mentah: string | null | undefined): string | null {
  if (!mentah) return null
  let digit = mentah.replace(/\D/g, '')
  if (digit.startsWith('0')) digit = '62' + digit.slice(1)
  else if (digit.startsWith('8')) digit = '62' + digit
  if (!digit.startsWith('62')) return null
  // 62 + 8..12 digit nomor seluler.
  if (digit.length < 10 || digit.length > 15) return null
  return digit
}

export function tautanWa(nomor: string, pesan: string): string {
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`
}

const LABEL_KONDISI: Record<string, string> = {
  rusak: 'RUSAK',
  perlu_perbaikan: 'PERLU PERBAIKAN',
}

/** Pesan pembuka HR ke AM untuk memastikan kondisi barang. */
export function pesanKonfirmasiAset(a: {
  namaAm: string | null
  namaHr: string
  outlet: string
  barang: string
  merek: string | null
  kondisi: string
  catatanAm: string | null
}): string {
  const sapaan = a.namaAm ? `Halo ${a.namaAm}` : 'Halo'
  const barang = a.merek ? `${a.barang} (${a.merek})` : a.barang
  const baris = [
    `${sapaan}, saya ${a.namaHr} dari HR Suka Shawarma.`,
    `Mau konfirmasi laporan inventaris *${a.outlet}*:`,
    `• ${barang} dilaporkan *${LABEL_KONDISI[a.kondisi] ?? a.kondisi}*`,
  ]
  if (a.catatanAm?.trim()) baris.push(`• Catatan: ${a.catatanAm.trim()}`)
  baris.push('', 'Bagaimana kondisinya sekarang, dan apa yang dibutuhkan (perbaikan atau penggantian)? Terima kasih.')
  return baris.join('\n')
}
