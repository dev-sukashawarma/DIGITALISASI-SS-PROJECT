/**
 * Batas tanggal "Berlaku mulai" HPP — harus sama dengan validasi di RPC `ubah_hpp_menu`:
 * bulan berjalan bebas; bulan lalu hanya sampai tanggal 10 bulan berjalan (WIB).
 */
const FORMAT_WIB = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function hariIniWib(): string {
  return FORMAT_WIB.format(new Date())
}

export function batasAwalBerlaku(hariIni: string): string {
  const [y, m, d] = hariIni.split('-').map(Number)
  if (d <= 10) {
    const tahun = m === 1 ? y - 1 : y
    const bulan = m === 1 ? 12 : m - 1
    return `${tahun}-${String(bulan).padStart(2, '0')}-01`
  }
  return `${y}-${String(m).padStart(2, '0')}-01`
}
