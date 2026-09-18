/**
 * Pilihan dua shift per outlet (toggle `pilih_shift_aktif` di pengaturan).
 * Shift 1 = jam_masuk/jam_keluar outlet, Shift 2 = shift2_jam_masuk/shift2_jam_keluar.
 * Dipakai bersama oleh kiosk (modal pilih shift), route submit, dan papan.
 */

export type ShiftKe = 1 | 2 | 3;

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
  shift3_jam_masuk?: string | null;
  shift3_jam_keluar?: string | null;
};

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Daftar shift yang wajib dipilih crew/staf, atau null bila outlet hanya satu shift.
 * Bila role === 'driver', otomatis diberikan 3 pilihan shift (termasuk 09:00–18:00).
 */
export function shiftOptions(
  cfg: ShiftConfig | null | undefined,
  role?: string | null
): ShiftOption[] | null {
  if (!cfg?.pilih_shift_aktif) return null;
  if (!cfg.jam_masuk || !cfg.jam_keluar || !cfg.shift2_jam_masuk || !cfg.shift2_jam_keluar) return null;

  const options: ShiftOption[] = [
    { ke: 1, jam_masuk: hhmm(cfg.jam_masuk), jam_keluar: hhmm(cfg.jam_keluar) },
    { ke: 2, jam_masuk: hhmm(cfg.shift2_jam_masuk), jam_keluar: hhmm(cfg.shift2_jam_keluar) },
  ];

  if (role === "driver") {
    const s3Masuk = cfg.shift3_jam_masuk ? hhmm(cfg.shift3_jam_masuk) : "09:00";
    const s3Keluar = cfg.shift3_jam_keluar ? hhmm(cfg.shift3_jam_keluar) : "18:00";
    options.push({ ke: 3, jam_masuk: s3Masuk, jam_keluar: s3Keluar });
  } else if (cfg.shift3_jam_masuk && cfg.shift3_jam_keluar) {
    options.push({ ke: 3, jam_masuk: hhmm(cfg.shift3_jam_masuk), jam_keluar: hhmm(cfg.shift3_jam_keluar) });
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
 * Outlet satu shift (opsi null) atau absen tanpa jejak shift → true (aturan lama:
 * semua yang absen pulang dianggap menutup).
 */
export function isShiftPenutup(opsi: ShiftOption[] | null, jamKeluarShift: string | null | undefined): boolean {
  if (!opsi || !jamKeluarShift) return true;
  const jam = hhmm(jamKeluarShift);
  const milik = opsi.find((o) => o.jam_keluar === jam);
  if (!milik) return true;
  const terakhir = Math.max(...opsi.map((o) => menitPulang(o.jam_masuk, o.jam_keluar)));
  return menitPulang(milik.jam_masuk, milik.jam_keluar) === terakhir;
}

export function isShiftKe(v: unknown): v is ShiftKe {
  return v === 1 || v === 2 || v === 3;
}
