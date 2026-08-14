// Jatuh tempo = tanggal barang datang + termin_hari. Sejalan dengan
// po_on_verified() di DB; direplikasi di TS agar UI bisa menampilkan estimasi.
export function computeDueDate(arrivalISO: string, terminHari: number | null): string | null {
  if (terminHari == null) return null
  const d = new Date(arrivalISO.slice(0, 10) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + terminHari)
  return d.toISOString().slice(0, 10)
}
