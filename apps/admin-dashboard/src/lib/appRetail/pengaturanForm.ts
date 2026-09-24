export type InputPengaturan = {
  menitPesanTerakhir: number
  menitTertahan: number
  estimasiSiap: string
  waCs: string
  versiMinimumAndroid: number
  urlSyarat: string
  urlPrivasi: string
}

export function normalisasiWa(nilai: string): string | null {
  const angka = nilai.replace(/[^0-9]/g, '')
  if (angka === '') return null
  if (angka.startsWith('0')) return `62${angka.slice(1)}`
  return angka
}

/** Cermin CHECK di migration 20260924100000 -- ubah keduanya bersamaan. */
export function periksaPengaturan(i: InputPengaturan): string | null {
  if (!Number.isInteger(i.menitPesanTerakhir) || i.menitPesanTerakhir < 0 || i.menitPesanTerakhir > 180)
    return 'Batas pesan terakhir harus 0–180 menit.'
  if (!Number.isInteger(i.menitTertahan) || i.menitTertahan < 1 || i.menitTertahan > 120)
    return 'Batas tertahan harus 1–120 menit.'
  const est = i.estimasiSiap.trim()
  if (est.length < 1 || est.length > 40) return 'Estimasi waktu siap wajib diisi (maks 40 huruf).'
  if (!Number.isInteger(i.versiMinimumAndroid) || i.versiMinimumAndroid < 1) return 'Versi minimum minimal 1.'
  const wa = normalisasiWa(i.waCs)
  if (wa !== null && !/^62[0-9]{8,13}$/.test(wa)) return 'Nomor WhatsApp CS tidak sah.'
  for (const url of [i.urlSyarat, i.urlPrivasi]) {
    if (url.trim() !== '' && !url.trim().startsWith('https://')) return 'Link harus diawali https://'
  }
  return null
}
