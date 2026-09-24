/**
 * `kiosk_settings.unavailable_menu_ids` dipakai BERSAMA dengan POS. Admin
 * hanya mengatur menu aplikasi; id lain di daftar (menu POS saja) WAJIB
 * dipertahankan, kalau tidak dialog ini diam-diam "menjual lagi" menu kasir.
 */
export function gabungDaftarHabis(daftarLama: string | null, idMenuAplikasi: string[], idHabisBaru: string[]): string {
  let lama: string[] = []
  try {
    const v = daftarLama ? JSON.parse(daftarLama) : []
    lama = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { lama = [] }
  const aplikasi = new Set(idMenuAplikasi)
  const dipertahankan = lama.filter((id) => !aplikasi.has(id))
  const habisBaruSah = idHabisBaru.filter((x): x is string => typeof x === 'string')
  return JSON.stringify([...new Set([...dipertahankan, ...habisBaruSah])])
}
