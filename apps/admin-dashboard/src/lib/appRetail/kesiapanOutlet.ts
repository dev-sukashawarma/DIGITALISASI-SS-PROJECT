export type OutletApp = {
  id: string
  name: string
  type: string | null
  is_active: boolean
  app_enabled: boolean
}

/**
 * Diekspor supaya pemanggil bisa MENAHAN peringatan ini saat jumlah menu tidak
 * diketahui (kueri gagal) — menahan lebih benar daripada menuduh "nol menu".
 */
export const PERINGATAN_NOL_MENU = 'Nol menu tayang — katalog akan kosong'

export type Kesiapan = {
  /** Pelanggan bisa memilih outlet ini di aplikasi. */
  melayani: boolean
  /** Keadaan yang perlu dilihat manusia. Kosong berarti sehat. */
  peringatan: string[]
}

/**
 * Membaca kesiapan satu outlet untuk aplikasi.
 *
 * Peringatan hanya muncul untuk outlet yang MELAYANI. Outlet yang memang
 * dimatikan tidak punya masalah untuk dilaporkan — memberinya peringatan
 * membuat daftar penuh bunyi yang tidak menuntut tindakan apa pun.
 */
export function periksaKesiapanOutlet(outlet: OutletApp, jumlahMenuTayang: number): Kesiapan {
  const melayani = outlet.app_enabled
  const peringatan: string[] = []

  if (melayani) {
    // GET /api/v1/outlets menyaring app_enabled tanpa menyaring is_active,
    // jadi outlet nonaktif tetap ditawarkan ke pelanggan. Endpoint sengaja
    // TIDAK diubah di tahap ini; keadaannya ditandai supaya terlihat.
    if (!outlet.is_active) peringatan.push('Outlet nonaktif tapi masih melayani aplikasi')
    if (jumlahMenuTayang <= 0) peringatan.push(PERINGATAN_NOL_MENU)
  }

  return { melayani, peringatan }
}
