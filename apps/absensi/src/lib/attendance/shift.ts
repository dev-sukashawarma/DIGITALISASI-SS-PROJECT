/**
 * Shift jadwal khusus outlet (toggle `pilih_shift_aktif` di pengaturan), 1–12 shift.
 * Sumber utama: tabel `outlet_attendance_shift` — `urutan` = nomor `shift_ke` yang dikirim
 * klien — dibaca lewat RPC `attendance_shift_config` / `list_outlet_attendance_config`.
 * Kolom lama (jam_masuk/jam_keluar = Shift 1, shift2_* = Shift 2) hanya jadi cadangan bila
 * daftar shift belum ada.
 * Dipakai bersama oleh kiosk (modal pilih shift), panel absen pribadi, dan pengaturan.
 * Aturan yang mengikat tetap di server (RPC submit_attendance); helper di sini hanya
 * cermin untuk tampilan & gerbang di klien.
 */

/** Nomor shift: urutan shift outlet (1..MAX_SHIFT) atau DRIVER_SHIFT_KE. */
export type ShiftKe = number;

/** Batas jumlah shift per outlet — sama dengan CHECK di tabel outlet_attendance_shift. */
export const MAX_SHIFT = 12;

/** Shift khusus driver (09:00–18:00) di luar daftar shift outlet — sama dengan RPC. */
export const DRIVER_SHIFT_KE = 99;
const DRIVER_JAM_MASUK = "09:00";
const DRIVER_JAM_KELUAR = "18:00";

export type ShiftOption = {
  ke: ShiftKe;
  /** Nama tampilan: nama khusus dari pengaturan, atau sebutan otomatis dari jam masuk. */
  nama: string;
  jam_masuk: string; // "HH:MM"
  jam_keluar: string; // "HH:MM"
};

/** Satu baris shift outlet seperti dikembalikan RPC (`ke` = urutan). */
export type ShiftRow = {
  ke: number;
  nama: string | null;
  jam_masuk: string;
  jam_keluar: string;
};

export type ShiftConfig = {
  jam_masuk?: string | null;
  jam_keluar?: string | null;
  pilih_shift_aktif?: boolean | null;
  shift2_jam_masuk?: string | null;
  shift2_jam_keluar?: string | null;
  shifts?: ShiftRow[] | null;
};

const hhmm = (t: string) => t.slice(0, 5);

function buatOpsi(ke: number, jamMasuk: string, jamKeluar: string, nama?: string | null): ShiftOption {
  const masuk = hhmm(jamMasuk);
  return { ke, nama: nama?.trim() || namaShift(masuk), jam_masuk: masuk, jam_keluar: hhmm(jamKeluar) };
}

/**
 * Normalisasi baris shift dari sumber mana pun — RPC (`ke`) maupun embed tabel
 * (`urutan`, jam "HH:MM:SS") — menjadi ShiftRow berjam "HH:MM", urut nomor shift.
 */
export function keShiftRows(raw: unknown): ShiftRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => ({
      ke: Number(r?.ke ?? r?.urutan),
      nama: typeof r?.nama === "string" && r.nama.trim() ? r.nama.trim() : null,
      jam_masuk: typeof r?.jam_masuk === "string" ? hhmm(r.jam_masuk) : "",
      jam_keluar: typeof r?.jam_keluar === "string" ? hhmm(r.jam_keluar) : "",
    }))
    .filter((r) => Number.isInteger(r.ke) && r.jam_masuk && r.jam_keluar)
    .sort((a, b) => a.ke - b.ke);
}

/**
 * Daftar shift yang wajib dipilih crew/staf, atau null bila outlet tidak memakai pilihan
 * shift (toggle mati atau kurang dari dua shift — server pun tidak meminta shift_ke).
 * Role driver mendapat tambahan Shift Driver 09:00–18:00 (nomor DRIVER_SHIFT_KE).
 */
export function shiftOptions(
  cfg: ShiftConfig | null | undefined,
  role?: string | null
): ShiftOption[] | null {
  if (!cfg?.pilih_shift_aktif) return null;

  let options: ShiftOption[];
  const rows = keShiftRows(cfg.shifts);
  if (rows.length > 0) {
    options = rows.map((s) => buatOpsi(s.ke, s.jam_masuk, s.jam_keluar, s.nama));
  } else {
    // Cadangan data lama: dua kolom datar, keduanya wajib lengkap.
    if (!cfg.jam_masuk || !cfg.jam_keluar || !cfg.shift2_jam_masuk || !cfg.shift2_jam_keluar) return null;
    options = [
      buatOpsi(1, cfg.jam_masuk, cfg.jam_keluar),
      buatOpsi(2, cfg.shift2_jam_masuk, cfg.shift2_jam_keluar),
    ];
  }
  if (options.length < 2) return null;

  if (role === "driver") {
    options.push({ ke: DRIVER_SHIFT_KE, nama: "Shift Driver", jam_masuk: DRIVER_JAM_MASUK, jam_keluar: DRIVER_JAM_KELUAR });
  }
  return options;
}

/** Sebutan shift dari jam masuknya: Pagi (<11), Siang (<15), Sore/Malam. */
export function namaShift(jamMasuk: string): string {
  const h = Number(jamMasuk.slice(0, 2));
  if (h < 11) return "Shift Pagi";
  if (h < 15) return "Shift Siang";
  return "Shift Malam";
}

/** Menit jam pulang; shift yang pulang lewat tengah malam (keluar < masuk) dihitung hari berikutnya. */
function menitPulang(jamMasuk: string, jamKeluar: string): number {
  const menit = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const keluar = menit(jamKeluar);
  return keluar < menit(jamMasuk) ? keluar + 24 * 60 : keluar;
}

/**
 * Apakah crew dengan jam pulang `jamKeluarShift` adalah shift PENUTUP outlet —
 * shift yang pulang paling akhir. Hanya shift penutup yang wajib menunggu laci
 * kasir ditutup, pesanan selesai, dan checklist penutupan; crew shift pagi boleh
 * pulang walau outlet masih buka.
 *
 * Sama dengan server: batas "paling akhir" dihitung dari shift OUTLET saja (Shift
 * Driver tidak ikut), dan shift seseorang penutup bila menit pulangnya >= batas itu.
 * `jamMasukShift` (jejak absen masuk) dipakai bila ada, agar shift lewat tengah malam
 * dihitung tepat walau jam pulangnya sama dengan shift lain.
 *
 * Outlet tanpa pilihan shift (opsi null), absen tanpa jejak shift, atau jejak shift
 * yang tidak lagi ada di daftar → true (aturan lama: semua yang absen pulang dianggap menutup).
 */
export function isShiftPenutup(
  opsi: ShiftOption[] | null,
  jamKeluarShift: string | null | undefined,
  jamMasukShift?: string | null
): boolean {
  if (!opsi || !jamKeluarShift) return true;
  const keluar = hhmm(jamKeluarShift);
  const masuk = jamMasukShift ? hhmm(jamMasukShift) : null;
  const milik =
    (masuk ? opsi.find((o) => o.jam_keluar === keluar && o.jam_masuk === masuk) : undefined) ??
    opsi.find((o) => o.jam_keluar === keluar);
  if (!milik) return true;

  const shiftOutlet = opsi.filter((o) => o.ke !== DRIVER_SHIFT_KE);
  if (shiftOutlet.length === 0) return true;
  const terakhir = Math.max(...shiftOutlet.map((o) => menitPulang(o.jam_masuk, o.jam_keluar)));
  return menitPulang(masuk ?? milik.jam_masuk, keluar) >= terakhir;
}

/** Nomor shift yang sah dikirim klien: 1..MAX_SHIFT atau DRIVER_SHIFT_KE. */
export function isShiftKe(v: unknown): v is ShiftKe {
  return (
    typeof v === "number" &&
    Number.isInteger(v) &&
    ((v >= 1 && v <= MAX_SHIFT) || v === DRIVER_SHIFT_KE)
  );
}
