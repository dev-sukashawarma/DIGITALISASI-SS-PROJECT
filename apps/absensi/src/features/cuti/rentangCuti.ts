// Rentang cuti = tanggal mulai + jumlah hari (hari kalender, inklusif — outlet buka
// setiap hari). Semua murni di klien: pratinjau berubah seketika tanpa query ke server.
// Cermin RentangCuti.kt di app native (SUPER-APPS-SS-MOBILE feature/absensi ui/cuti).
//
// Tanggal selalu string "YYYY-MM-DD" dan dihitung di UTC, supaya zona waktu perangkat
// tidak menggeser hari (00:00 WIB = 17:00 UTC hari sebelumnya).

export const MAKS_HARI_CUTI = 30;
/** Cuti melahirkan wajar ~3 bulan; jenis lain di atas 30 hari hampir pasti salah ketuk. */
export const MAKS_HARI_MELAHIRKAN = 90;

export function maksHari(leaveType: string): number {
  return leaveType === "maternity" ? MAKS_HARI_MELAHIRKAN : MAKS_HARI_CUTI;
}

const HARI_MS = 86_400_000;

function keUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dariUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function tambahHari(iso: string, n: number): string {
  const ms = keUtc(iso);
  if (ms === null) throw new Error(`Tanggal tidak valid: ${iso}`);
  return dariUtc(ms + n * HARI_MS);
}

/** Tanggal lokal perangkat (bukan UTC) dalam bentuk "YYYY-MM-DD". */
export function hariIniLokal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface RentangCuti {
  mulai: string;
  selesai: string;
  hari: number;
  /** Hari pertama kembali bekerja. */
  masukKembali: string;
  tanggal: string[];
}

export function hitungRentang(mulai: string, hari: number): RentangCuti {
  if (!Number.isInteger(hari) || hari < 1) throw new Error("hari minimal 1");
  const tanggal = Array.from({ length: hari }, (_, i) => tambahHari(mulai, i));
  const selesai = tanggal[tanggal.length - 1];
  return { mulai, selesai, hari, masukKembali: tambahHari(selesai, 1), tanggal };
}

export interface BarisCuti {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  status_spv?: string | null;
}

/** Ditolak SPV atau HR = tanggalnya dilepas dan boleh diajukan ulang. */
function masihAktif(row: BarisCuti): boolean {
  return (row.status === "pending" || row.status === "approved") && row.status_spv !== "rejected";
}

/** Pengajuan lama yang masih aktif dan bertabrakan dengan [rentang] — dari riwayat
 *  yang sudah dimuat, tanpa query tambahan. */
export function pengajuanBentrok<T extends BarisCuti>(rentang: RentangCuti, riwayat: T[]): T | null {
  for (const row of riwayat) {
    if (!masihAktif(row)) continue;
    const awal = row.start_date?.slice(0, 10);
    const akhir = row.end_date?.slice(0, 10) || awal;
    if (keUtc(awal) === null || keUtc(akhir) === null) continue;
    // String "YYYY-MM-DD" urut leksikografis = urut kronologis.
    if (rentang.mulai <= akhir && rentang.selesai >= awal) return row;
  }
  return null;
}

/** Hari cuti disetujui pada [tahun] (per tanggal mulai). Hanya informasi: sisa kuota
 *  yang sah adalah outlet_staff.leave_quota, yang dipotong HR saat menyetujui
 *  (apps/HR useLeaveMutations) — jangan dikurangkan lagi dari angka ini. */
export function cutiTerpakaiTahun(riwayat: BarisCuti[], tahun: number): number {
  return riwayat
    .filter((r) => r.status === "approved" && r.start_date?.startsWith(`${tahun}-`))
    .reduce((n, r) => n + (r.days || 0), 0);
}

/** Total hari pengajuan yang masih menunggu keputusan. */
export function hariMenunggu(riwayat: BarisCuti[]): number {
  return riwayat.filter((r) => r.status === "pending" && r.status_spv !== "rejected").reduce((n, r) => n + (r.days || 0), 0);
}

const FMT_HARI_TGL = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const FMT_HARI_TGL_TAHUN = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const FMT_NAMA_HARI = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" });
const FMT_BULAN = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });

function fmt(f: Intl.DateTimeFormat, iso: string): string {
  const ms = keUtc(iso.slice(0, 10));
  return ms === null ? iso : f.format(ms);
}

export const formatHariTgl = (iso: string) => fmt(FMT_HARI_TGL, iso);
export const formatHariTglTahun = (iso: string) => fmt(FMT_HARI_TGL_TAHUN, iso);
export const formatNamaHari = (iso: string) => fmt(FMT_NAMA_HARI, iso);
export const formatBulan = (iso: string) => fmt(FMT_BULAN, iso);
export const tanggalKe = (iso: string) => Number(iso.slice(8, 10));
