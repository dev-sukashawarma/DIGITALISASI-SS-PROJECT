/**
 * Pilihan dua shift per outlet (toggle `pilih_shift_aktif` di pengaturan).
 * Shift 1 = jam_masuk/jam_keluar outlet, Shift 2 = shift2_jam_masuk/shift2_jam_keluar.
 * Dipakai bersama oleh kiosk (modal pilih shift), route submit, dan papan.
 */

export type ShiftKe = 1 | 2;

export type ShiftOption = {
  ke: ShiftKe;
  jam_masuk: string; // "HH:MM"
  jam_keluar: string; // "HH:MM"
};

export type ShiftConfig = {
  jam_masuk?: string | null;
  jam_keluar?: string | null;
  pilih_shift_aktif?: boolean | null;
  shift2_jam_masuk?: string | null;
  shift2_jam_keluar?: string | null;
};

const hhmm = (t: string) => t.slice(0, 5);

/** Daftar shift yang wajib dipilih crew, atau null bila outlet hanya satu shift. */
export function shiftOptions(cfg: ShiftConfig | null | undefined): ShiftOption[] | null {
  if (!cfg?.pilih_shift_aktif) return null;
  if (!cfg.jam_masuk || !cfg.jam_keluar || !cfg.shift2_jam_masuk || !cfg.shift2_jam_keluar) return null;
  return [
    { ke: 1, jam_masuk: hhmm(cfg.jam_masuk), jam_keluar: hhmm(cfg.jam_keluar) },
    { ke: 2, jam_masuk: hhmm(cfg.shift2_jam_masuk), jam_keluar: hhmm(cfg.shift2_jam_keluar) },
  ];
}

/** Sebutan shift dari jam masuknya: Pagi (<11), Siang (<15), Sore/Malam. */
export function namaShift(jamMasuk: string): string {
  const h = Number(jamMasuk.slice(0, 2));
  if (h < 11) return "Shift Pagi";
  if (h < 15) return "Shift Siang";
  return "Shift Malam";
}

export function isShiftKe(v: unknown): v is ShiftKe {
  return v === 1 || v === 2;
}
