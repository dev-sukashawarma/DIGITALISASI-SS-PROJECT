/**
 * Jadwal khusus outlet untuk layar Pengaturan: bentuk data, normalisasi dari server,
 * dan validasi daftar shift. Validasi di sini hanya cermin cepat untuk umpan balik —
 * sumber kebenarannya RPC `simpan_jadwal_outlet`.
 * Modul biasa (bukan "use client") agar bisa dipakai server component, server action,
 * dan komponen klien sekaligus.
 */
import { keShiftRows, MAX_SHIFT, type ShiftRow } from "./shift";

/** Satu baris di editor shift. `nama` kosong = pakai sebutan otomatis. */
export type ShiftDraft = { nama: string; jam_masuk: string; jam_keluar: string };

export type OutletJadwal = {
  outlet_id: string;
  jam_masuk: string; // "HH:MM" — cermin shift 1
  jam_keluar: string;
  toleransi_menit: number;
  absen_window_mode: "auto" | "manual";
  pilih_shift_aktif: boolean;
  /** Seluruh shift outlet, urut nomor. Minimal satu bila jam outlet terisi. */
  shifts: ShiftRow[];
};

export const NAMA_SHIFT_MAKS = 40;

const hhmm = (t: unknown) => (typeof t === "string" ? t.slice(0, 5) : "");

/**
 * Normalisasi satu baris config outlet — dari embed tabel (`shifts: [{urutan,...}]`)
 * maupun RPC list_outlet_attendance_config (`shifts: [{ke,...}]`). Baris lama tanpa
 * daftar shift dibangun dari kolom cermin (shift 1 + shift 2 bila ada).
 */
export function keOutletJadwal(row: any): OutletJadwal {
  const jamMasuk = hhmm(row?.jam_masuk);
  const jamKeluar = hhmm(row?.jam_keluar);
  let shifts = keShiftRows(row?.shifts);
  if (shifts.length === 0 && jamMasuk && jamKeluar) {
    shifts = [{ ke: 1, nama: null, jam_masuk: jamMasuk, jam_keluar: jamKeluar }];
    const s2Masuk = hhmm(row?.shift2_jam_masuk);
    const s2Keluar = hhmm(row?.shift2_jam_keluar);
    if (s2Masuk && s2Keluar) shifts.push({ ke: 2, nama: null, jam_masuk: s2Masuk, jam_keluar: s2Keluar });
  }
  return {
    outlet_id: String(row?.outlet_id ?? ""),
    jam_masuk: jamMasuk,
    jam_keluar: jamKeluar,
    toleransi_menit: Number(row?.toleransi_menit ?? 0) || 0,
    absen_window_mode: row?.absen_window_mode === "manual" ? "manual" : "auto",
    pilih_shift_aktif: !!row?.pilih_shift_aktif,
    shifts,
  };
}

/** Rapikan kiriman klien menjadi daftar ShiftDraft (buang yang bukan objek). */
export function keShiftDrafts(raw: unknown): ShiftDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r: any) => ({
      nama: typeof r.nama === "string" ? r.nama.trim() : "",
      jam_masuk: hhmm(r.jam_masuk),
      jam_keluar: hhmm(r.jam_keluar),
    }));
}

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pesan galat pertama, atau null bila daftar shift sah. Aturannya sama dengan
 * `simpan_jadwal_outlet`: 1–12 shift, jam lengkap & berformat HH:MM, masuk ≠ pulang,
 * tak ada dua shift berjam sama persis, nama ≤ 40 karakter, dan pilihan shift butuh ≥ 2.
 */
export function validasiShift(shifts: ShiftDraft[], pilihShiftAktif: boolean): string | null {
  if (shifts.length < 1 || shifts.length > MAX_SHIFT) return `Jumlah shift harus 1–${MAX_SHIFT}`;
  const terlihat = new Set<string>();
  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    const label = `Shift ${i + 1}`;
    if (!s.jam_masuk || !s.jam_keluar) return `Isi jam masuk dan jam pulang ${label}`;
    if (!POLA_JAM.test(s.jam_masuk) || !POLA_JAM.test(s.jam_keluar)) return `Format jam ${label} tidak valid (pakai HH:MM)`;
    if (s.jam_masuk === s.jam_keluar) return `Jam masuk dan jam pulang ${label} tidak boleh sama`;
    if (s.nama.length > NAMA_SHIFT_MAKS) return `Nama ${label} maksimal ${NAMA_SHIFT_MAKS} karakter`;
    const kunci = `${s.jam_masuk}-${s.jam_keluar}`;
    if (terlihat.has(kunci)) return `Ada dua shift dengan jam yang sama persis (${s.jam_masuk}–${s.jam_keluar})`;
    terlihat.add(kunci);
  }
  if (pilihShiftAktif && shifts.length < 2) return "Tambahkan minimal 2 shift untuk mengaktifkan pilihan shift";
  return null;
}

/** Menit → "HH:MM" (berputar 24 jam). */
function keJam(menit: number): string {
  const m = ((menit % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const keMenit = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Usulan shift baru: masuk = jam pulang shift terakhir, durasi sama dengan shift itu
 * (lewat tengah malam ikut dihitung). Bila jamnya sudah dipakai shift lain (mis. tiga
 * shift 8 jam yang sudah menutup 24 jam), digeser per jam. Tanpa shift: 09:00–17:00.
 */
export function usulanShiftBaru(shifts: ShiftDraft[]): ShiftDraft {
  const akhir = shifts[shifts.length - 1];
  if (!akhir || !POLA_JAM.test(akhir.jam_masuk) || !POLA_JAM.test(akhir.jam_keluar)) {
    return { nama: "", jam_masuk: "09:00", jam_keluar: "17:00" };
  }
  const durasi = (((keMenit(akhir.jam_keluar) - keMenit(akhir.jam_masuk)) % 1440) + 1440) % 1440 || 480;
  const dipakai = new Set(shifts.map((s) => `${s.jam_masuk}-${s.jam_keluar}`));
  let masuk = keMenit(akhir.jam_keluar);
  for (let geser = 0; geser < 24 && dipakai.has(`${keJam(masuk)}-${keJam(masuk + durasi)}`); geser++) {
    masuk += 60;
  }
  return { nama: "", jam_masuk: keJam(masuk), jam_keluar: keJam(masuk + durasi) };
}
