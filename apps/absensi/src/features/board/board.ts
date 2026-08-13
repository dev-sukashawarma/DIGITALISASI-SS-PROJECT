import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export type BoardStaff = { id: string; name: string; role: string };
export type BoardRecord = {
  outlet_staff_id: string;
  type: "in" | "out";
  status: "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat" | "telat_toleransi";
  ts_server: string;
  selfie_url?: string | null;
  telat_menit?: number | null;
  is_manual_button?: boolean | null;
};

export type BoardConfig = {
  jam_masuk: string;
  jam_keluar?: string;
  toleransi_menit: number;
};

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
  const expectedMinutes = h * 60 + m;

  const t = dayjs(tsServer).tz("Asia/Jakarta");
  const actualMinutes = t.hour() * 60 + t.minute();

  const diff = actualMinutes - expectedMinutes;
  return diff > 0 ? diff : 0;
}

/** Hitung papan kehadiran: status terbaru tiap staff + ringkasan. */
export function computeBoard(staff: BoardStaff[], records: BoardRecord[], config: BoardConfig): {
  rows: BoardRow[];
  summary: BoardSummary;
} {
  const byStaff = new Map<string, BoardRecord[]>();
  for (const r of records) {
    const arr = byStaff.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    byStaff.set(r.outlet_staff_id, arr);
  }

  const now = new Date();
  const [h, m] = config.jam_masuk.split(":").map(Number);
  const deadline = new Date();
  deadline.setHours(h, m + config.toleransi_menit, 0, 0);
  const isPastDeadline = now.getTime() > deadline.getTime();

  const rows: BoardRow[] = staff.map((s) => {
    const recs = (byStaff.get(s.id) ?? []).slice().sort((a, b) => a.ts_server.localeCompare(b.ts_server));
    const inRec = recs.find((r) => r.type === "in");
    const outRec = recs.filter((r) => r.type === "out").pop();
    
    if (outRec) {
      let state: BoardState = "keluar";
      if (outRec.status === "lebih_awal") state = "lebih_awal";
      if (outRec.status === "pulang_telat") state = "pulang_telat";
      
      let delay_minutes = null;
      if (config.jam_keluar && (state === "lebih_awal" || state === "pulang_telat")) {
        delay_minutes = outRec.telat_menit ?? Math.abs(calculateDelayMinutes(outRec.ts_server, config.jam_keluar));
      }
      return { id: s.id, name: s.name, role: s.role, state, time: jam(outRec.ts_server), selfie_url: outRec.selfie_url || null, delay_minutes, is_manual_button: outRec.is_manual_button || false };
    }    
    if (inRec) {
      let state: BoardState = "masuk";
      if (inRec.status === "telat") state = "telat";
      if (inRec.status === "telat_toleransi") state = "telat_toleransi";
      const delay_minutes = (state === "telat" || state === "telat_toleransi") ? (inRec.telat_menit ?? calculateDelayMinutes(inRec.ts_server, config.jam_masuk)) : null;
      return { id: s.id, name: s.name, role: s.role, state, time: jam(inRec.ts_server), selfie_url: inRec.selfie_url || null, delay_minutes, is_manual_button: inRec.is_manual_button || false };
    }
    
    // Belum absen
    if (isPastDeadline) {
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
