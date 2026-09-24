/**
 * Status pesan-bisa-tidaknya sebuah outlet di aplikasi.
 *
 * SATU sumber aturan untuk gateway (penegak) dan admin-dashboard (tampilan);
 * salinan ini WAJIB identik dengan apps/retail-gateway/src/lib/jamBuka.ts.
 *
 * Semua jam dihitung di Asia/Jakarta (UTC+7, tanpa DST). Menghitung dengan
 * jam server (UTC) membuat 00.00-07.00 WIB terbaca sebagai "kemarin" --
 * pelajaran drop-ship 2026-09-11.
 */
export type AlasanStatus =
  | 'buka' | 'nonaktif' | 'tutup_sementara' | 'belum_buka' | 'sudah_tutup' | 'lewat_pesan_terakhir'
export type TutupSementara = { sampai: Date; alasan: string | null }
export type StatusOutlet = {
  bisaPesan: boolean
  alasan: AlasanStatus
  bukaLagi: Date | null
  pesanTerakhir: Date | null
  alasanTutup: string | null
}

const WIB_MS = 7 * 60 * 60 * 1000
const MENIT_MS = 60 * 1000
const HARI_MS = 24 * 60 * MENIT_MS

/** Menit sejak 00.00 dari 'HH:MM[:SS]'; null bila tak terbaca. */
function keMenit(jam: string | null): number | null {
  if (!jam) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(jam)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Awal hari (00.00 WIB) yang memuat `t`, dalam epoch ms. */
function awalHariWib(t: number): number {
  return Math.floor((t + WIB_MS) / HARI_MS) * HARI_MS - WIB_MS
}

export function statusOutlet(input: {
  sekarang: Date
  openHour: string | null
  closeHour: string | null
  isActive: boolean
  tutupSementara: TutupSementara[]
  menitPesanTerakhir: number
}): StatusOutlet {
  const kosong = { bukaLagi: null, pesanTerakhir: null, alasanTutup: null }
  const t = input.sekarang.getTime()

  if (!input.isActive) return { bisaPesan: false, alasan: 'nonaktif', ...kosong }

  const berlaku = input.tutupSementara
    .filter((x) => x.sampai.getTime() > t)
    .sort((a, b) => b.sampai.getTime() - a.sampai.getTime())[0]
  if (berlaku) {
    return { bisaPesan: false, alasan: 'tutup_sementara', bukaLagi: berlaku.sampai, pesanTerakhir: null, alasanTutup: berlaku.alasan }
  }

  const buka = keMenit(input.openHour)
  const tutup = keMenit(input.closeHour)
  if (buka === null || tutup === null) return { bisaPesan: true, alasan: 'buka', ...kosong }

  const hariIni = awalHariWib(t)
  const lewatTengahMalam = tutup <= buka
  // Sesi yang sedang/terakhir berjalan: mulai hari ini, atau kemarin bila sesi
  // melewati tengah malam dan kita masih di bagian dini harinya.
  const menitSekarang = Math.floor((t - hariIni) / MENIT_MS)
  const mulaiHari = lewatTengahMalam && menitSekarang < tutup ? hariIni - HARI_MS : hariIni
  const mulai = mulaiHari + buka * MENIT_MS
  const selesai = mulaiHari + (lewatTengahMalam ? tutup + 24 * 60 : tutup) * MENIT_MS
  const batasPesan = selesai - input.menitPesanTerakhir * MENIT_MS
  const bukaBerikut = t < mulai ? mulai : mulai + HARI_MS

  if (t < mulai) return { bisaPesan: false, alasan: 'belum_buka', bukaLagi: new Date(mulai), pesanTerakhir: null, alasanTutup: null }
  if (t >= selesai) return { bisaPesan: false, alasan: 'sudah_tutup', bukaLagi: new Date(bukaBerikut), pesanTerakhir: null, alasanTutup: null }
  if (t >= batasPesan) {
    return { bisaPesan: false, alasan: 'lewat_pesan_terakhir', bukaLagi: new Date(bukaBerikut), pesanTerakhir: new Date(batasPesan), alasanTutup: null }
  }
  return { bisaPesan: true, alasan: 'buka', bukaLagi: null, pesanTerakhir: new Date(batasPesan), alasanTutup: null }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function jamWib(d: Date): string {
  const w = new Date(d.getTime() + WIB_MS)
  return `${String(w.getUTCHours()).padStart(2, '0')}.${String(w.getUTCMinutes()).padStart(2, '0')}`
}
function tanggalWib(d: Date): string {
  const w = new Date(d.getTime() + WIB_MS)
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]}`
}

/** Kalimat untuk pelanggan. Dipakai sebagai `pesan` di balasan gateway. */
export function pesanStatus(s: StatusOutlet): string {
  switch (s.alasan) {
    case 'buka': return 'Outlet buka.'
    case 'nonaktif': return 'Outlet sedang tidak melayani pesanan.'
    case 'tutup_sementara': {
      const alasan = s.alasanTutup ? ` (${s.alasanTutup})` : ''
      return `Outlet tutup sementara${alasan}. Buka lagi ${tanggalWib(s.bukaLagi!)} pukul ${jamWib(s.bukaLagi!)}.`
    }
    case 'belum_buka': return `Outlet belum buka. Buka pukul ${jamWib(s.bukaLagi!)}.`
    case 'sudah_tutup': return `Outlet sudah tutup. Buka lagi pukul ${jamWib(s.bukaLagi!)}.`
    case 'lewat_pesan_terakhir':
      return `Pesanan terakhir hari ini pukul ${jamWib(s.pesanTerakhir!)}. Buka lagi pukul ${jamWib(s.bukaLagi!)}.`
  }
}
