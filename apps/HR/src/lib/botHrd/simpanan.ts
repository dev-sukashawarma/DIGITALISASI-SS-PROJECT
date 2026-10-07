const KUNCI = 'botHrd.percakapan'

export function bacaPercakapan(simpanan: Storage | null, hariIni: string): string | null {
  try {
    const v = simpanan?.getItem(KUNCI)
    if (!v) return null
    const o = JSON.parse(v) as { id?: string; tanggal?: string }
    return o.tanggal === hariIni && typeof o.id === 'string' ? o.id : null
  } catch {
    return null
  }
}

export function simpanPercakapan(simpanan: Storage | null, id: string, hariIni: string): void {
  try {
    simpanan?.setItem(KUNCI, JSON.stringify({ id, tanggal: hariIni }))
  } catch {
    /* storage diblokir: percakapan tetap jalan, hanya tak diingat */
  }
}

export function hapusPercakapan(simpanan: Storage | null): void {
  try {
    simpanan?.removeItem(KUNCI)
  } catch {
    /* abaikan */
  }
}
