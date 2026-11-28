/**
 * Aturan jam pengajuan petty cash (semua dalam zona waktu WIB / Asia/Jakarta):
 * - Top-up petty cash: input outlet 09:00–16:00 WIB; batas proses Finance & auto-batal
 *   pukul 17:00 WIB (tersedia jalur Proses Darurat di hari yang sama bila mendesak).
 * - Pengeluaran outlet di POS: 06:00–21:00 WIB.
 */

export const TOPUP_JAM_BUKA_WIB = 9
export const TOPUP_JAM_TUTUP_WIB = 16
export const TOPUP_JAM_AUTO_BATAL_WIB = 17

export const PENGELUARAN_JAM_BUKA_WIB = 6
export const PENGELUARAN_JAM_TUTUP_WIB = 21

export function jamWib(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  return h === 24 ? 0 : h
}

export function tanggalWib(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

/**
 * Selaras dengan RPC `finance_process_petty_cash_custom`: pencairan top-up normal
 * hanya dapat disetujui sebelum pukul 17:00 WIB pada hari yang sama dengan tanggal
 * pengajuan WIB. Bila `isDarurat = true` pada hari yang sama, pencairan tetap diizinkan
 * melewati pukul 17:00 WIB.
 */
export function cekBatasProsesFinanceTopupWib(
  createdAtIso?: string | null,
  now: Date = new Date(),
  isDarurat = false,
): {
  diizinkan: boolean
  pesan: string | null
} {
  const h = jamWib(now)
  const hariSekarang = tanggalWib(now)
  let dariHariSebelumnya = false
  if (createdAtIso) {
    const parsed = new Date(createdAtIso)
    if (!Number.isNaN(parsed.getTime())) {
      dariHariSebelumnya = tanggalWib(parsed) < hariSekarang
    }
  }
  if (dariHariSebelumnya) {
    return {
      diizinkan: false,
      pesan: 'Pengajuan top up dari hari sebelumnya tidak dapat dicairkan. Minta outlet mengajukan ulang pukul 09:00–16:00 WIB.',
    }
  }
  if (!isDarurat && h >= TOPUP_JAM_AUTO_BATAL_WIB) {
    return {
      diizinkan: false,
      pesan: 'Pengajuan top up petty cash sudah melewati batas waktu proses pukul 17:00 WIB. Gunakan tombol Proses Darurat di halaman Petty Cash bila mendesak.',
    }
  }
  return { diizinkan: true, pesan: null }
}

export function bisaProsesDaruratTopup(
  row: { status: string; created_at: string; description?: string | null; reason?: string | null },
  now: Date = new Date(),
): boolean {
  if (row.status !== 'rejected') return false
  const teks = `${row.description ?? ''} ${row.reason ?? ''}`
  if (!teks.includes('Dibatalkan otomatis oleh sistem')) return false
  const created = new Date(row.created_at)
  if (Number.isNaN(created.getTime())) return false
  return tanggalWib(created) === tanggalWib(now)
}

export function cekJamPengajuanTopupWib(now: Date = new Date()): {
  diizinkan: boolean
  pesan: string | null
} {
  const h = jamWib(now)
  const diizinkan = h >= TOPUP_JAM_BUKA_WIB && h < TOPUP_JAM_TUTUP_WIB
  return {
    diizinkan,
    pesan: diizinkan
      ? null
      : 'Pengajuan top up petty cash hanya dibuka pukul 09:00 hingga 16:00 WIB. Pengajuan yang belum diproses Finance melewati pukul 17:00 WIB akan dibatalkan otomatis oleh sistem.',
  }
}

export function cekJamPengeluaranPosWib(now: Date = new Date()): {
  diizinkan: boolean
  pesan: string | null
} {
  const h = jamWib(now)
  const diizinkan = h >= PENGELUARAN_JAM_BUKA_WIB && h < PENGELUARAN_JAM_TUTUP_WIB
  return {
    diizinkan,
    pesan: diizinkan
      ? null
      : 'Pengajuan pengeluaran outlet hanya dapat dilakukan pukul 06:00 hingga 21:00 WIB.',
  }
}
