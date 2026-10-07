import { batasWib, menitWib, tanggalWib } from "./waktu";

export type BoardStaff = { id: string; name: string; role: string };
export type BoardRecord = {
  outlet_staff_id: string;
  type: "in" | "out";
  status: "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat" | "telat_toleransi";
  ts_server: string;
  selfie_url?: string | null;
  telat_menit?: number | null;
  is_manual_button?: boolean | null;
  shift_jam_masuk?: string | null;
  shift_jam_keluar?: string | null;
};

export type BoardConfig = {
  jam_masuk: string;
  jam_keluar?: string;
  toleransi_menit: number;
  pilih_shift_aktif?: boolean | null;
  /** Cermin lama shift urutan 2 — cadangan bila daftar shift kosong. */
  shift2_jam_masuk?: string | null;
  /** Jam masuk seluruh shift outlet (tabel outlet_attendance_shift). */
  shifts_jam_masuk?: string[] | null;
};

/**
 * Jam masuk acuan batas alpha. Outlet berpilihan shift: shift yang masuk PALING
 * AKHIR — crew shift siang/malam tak boleh tercap alpha di pagi hari. Selain itu
 * (atau data shift kosong) jam masuk outlet.
 */
export function jamMasukBatasAlpha(config: BoardConfig): string {
  const dasar = config.jam_masuk.slice(0, 5);
  if (!config.pilih_shift_aktif) return dasar;
  const kandidat = (config.shifts_jam_masuk?.length ? config.shifts_jam_masuk : [config.shift2_jam_masuk])
    .filter((j): j is string => typeof j === "string" && j.length >= 5)
    .map((j) => j.slice(0, 5));
  return kandidat.reduce((maks, j) => (j > maks ? j : maks), dasar);
}

/**
 * Jam masuk acuan batas alpha untuk SATU staf: jam masuk jadwal khusus stafnya di outlet
 * ini bila ada (aturan dari Pengaturan, berlaku setiap hari), selain itu batas outlet.
 */
export function jamMasukBatasAlphaStaf(config: BoardConfig, jamMasukAturan?: string | null): string {
  return jamMasukAturan && jamMasukAturan.length >= 5 ? jamMasukAturan.slice(0, 5) : jamMasukBatasAlpha(config);
}

export type BoardState = "masuk" | "telat" | "telat_toleransi" | "keluar" | "belum" | "alpha" | "lebih_awal" | "pulang_telat";
export type BoardRow = { 
  id: string; 
  name: string; 
  role: string; 
  state: BoardState; 
  time: string | null;
  selfie_url: string | null;
  delay_minutes: number | null;
  is_manual_button: boolean | null;
};
export type BoardSummary = { hadir: number; telat: number; telat_toleransi: number; belum: number; alpha: number; total: number };

function jam(ts: string): string {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

function calculateDelayMinutes(tsServer: string, jamMasuk: string): number {
  const [h, m] = jamMasuk.split(":").map(Number);
  const diff = menitWib(tsServer) - (h * 60 + m);
  return diff > 0 ? diff : 0;
}

/**
 * Hitung papan kehadiran: status terbaru tiap staff + ringkasan.
 * `jamMasukAturan`: staff_id → jam masuk jadwal khusus staf di outlet ini ("HH:MM").
 */
export type OpsiPapan = {
  /** Instan "sekarang" (default: jam sistem). */
  sekarang?: Date;
  /** Tanggal papan WIB YYYY-MM-DD (default: tanggal WIB dari `sekarang`). */
  tanggal?: string;
};

export function computeBoard(
  staff: BoardStaff[],
  records: BoardRecord[],
  config: BoardConfig,
  jamMasukAturan?: ReadonlyMap<string, string>,
  opsi: OpsiPapan = {},
): {
  rows: BoardRow[];
  summary: BoardSummary;
} {
  const byStaff = new Map<string, BoardRecord[]>();
  for (const r of records) {
    const arr = byStaff.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    byStaff.set(r.outlet_staff_id, arr);
  }

  const now = opsi.sekarang ?? new Date();
  const tanggal = opsi.tanggal ?? tanggalWib(now);
  // Outlet berpilihan shift: yang belum absen baru dianggap alpha setelah shift
  // TERAKHIR lewat batas — crew siang tak boleh tercap alpha di pagi hari.
  // Staf berjadwal khusus memakai jam masuk aturannya sendiri (toleransi tetap outlet).
  // Batas dihitung dalam WIB (dulu memakai zona server → di container UTC telat 7 jam).
  const lewatBatasPerJam = new Map<string, boolean>();
  const lewatBatas = (staffId: string): boolean => {
    const jamMasuk = jamMasukBatasAlphaStaf(config, jamMasukAturan?.get(staffId));
    let hasil = lewatBatasPerJam.get(jamMasuk);
    if (hasil === undefined) {
      hasil = now.getTime() > batasWib(tanggal, jamMasuk, config.toleransi_menit).getTime();
      lewatBatasPerJam.set(jamMasuk, hasil);
    }
    return hasil;
  };

  const rows: BoardRow[] = staff.map((s) => {
    const recs = (byStaff.get(s.id) ?? []).slice().sort((a, b) => a.ts_server.localeCompare(b.ts_server));
    const inRec = recs.find((r) => r.type === "in");
    const outRec = recs.filter((r) => r.type === "out").pop();
    
    if (outRec) {
      let state: BoardState = "keluar";
      if (outRec.status === "lebih_awal") state = "lebih_awal";
      if (outRec.status === "pulang_telat") state = "pulang_telat";
      
      let delay_minutes = null;
      const targetKeluar = outRec.shift_jam_keluar ?? config.jam_keluar;
      if (targetKeluar && (state === "lebih_awal" || state === "pulang_telat")) {
        delay_minutes = outRec.telat_menit ?? Math.abs(calculateDelayMinutes(outRec.ts_server, targetKeluar));
      }
      return { id: s.id, name: s.name, role: s.role, state, time: jam(outRec.ts_server), selfie_url: outRec.selfie_url || null, delay_minutes, is_manual_button: outRec.is_manual_button || false };
    }    
    if (inRec) {
      let state: BoardState = "masuk";
      if (inRec.status === "telat") state = "telat";
      if (inRec.status === "telat_toleransi") state = "telat_toleransi";
      const delay_minutes = (state === "telat" || state === "telat_toleransi") ? (inRec.telat_menit ?? calculateDelayMinutes(inRec.ts_server, inRec.shift_jam_masuk ?? config.jam_masuk)) : null;
      return { id: s.id, name: s.name, role: s.role, state, time: jam(inRec.ts_server), selfie_url: inRec.selfie_url || null, delay_minutes, is_manual_button: inRec.is_manual_button || false };
    }
    
    // Belum absen
    if (lewatBatas(s.id)) {
      return { id: s.id, name: s.name, role: s.role, state: "alpha", time: null, selfie_url: null, delay_minutes: null, is_manual_button: false };
    }
    
    return { id: s.id, name: s.name, role: s.role, state: "belum", time: null, selfie_url: null, delay_minutes: null, is_manual_button: false };
  });

  const summary: BoardSummary = {
    hadir: rows.filter((r) => r.state === "masuk" || r.state === "keluar").length,
    telat: rows.filter((r) => r.state === "telat").length,
    telat_toleransi: rows.filter((r) => r.state === "telat_toleransi").length,
    belum: rows.filter((r) => r.state === "belum").length,
    alpha: rows.filter((r) => r.state === "alpha").length,
    total: staff.length,
  };
  return { rows, summary };
}
