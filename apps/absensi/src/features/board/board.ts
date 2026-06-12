export type BoardStaff = { id: string; name: string; role: string };
export type BoardRecord = {
  outlet_staff_id: string;
  type: "in" | "out";
  status: "tepat" | "telat" | "alpha";
  ts_server: string;
};

export type BoardState = "masuk" | "telat" | "keluar" | "belum";
export type BoardRow = { id: string; name: string; role: string; state: BoardState; time: string | null };
export type BoardSummary = { hadir: number; telat: number; belum: number; total: number };

function jam(ts: string): string {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Hitung papan kehadiran: status terbaru tiap staff + ringkasan. */
export function computeBoard(staff: BoardStaff[], records: BoardRecord[]): {
  rows: BoardRow[];
  summary: BoardSummary;
} {
  const byStaff = new Map<string, BoardRecord[]>();
  for (const r of records) {
    const arr = byStaff.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    byStaff.set(r.outlet_staff_id, arr);
  }

  const rows: BoardRow[] = staff.map((s) => {
    const recs = (byStaff.get(s.id) ?? []).slice().sort((a, b) => a.ts_server.localeCompare(b.ts_server));
    const inRec = recs.find((r) => r.type === "in");
    const outRec = recs.filter((r) => r.type === "out").pop();
    if (outRec) return { id: s.id, name: s.name, role: s.role, state: "keluar", time: jam(outRec.ts_server) };
    if (inRec) {
      const state: BoardState = inRec.status === "telat" ? "telat" : "masuk";
      return { id: s.id, name: s.name, role: s.role, state, time: jam(inRec.ts_server) };
    }
    return { id: s.id, name: s.name, role: s.role, state: "belum", time: null };
  });

  const summary: BoardSummary = {
    hadir: rows.filter((r) => r.state !== "belum").length,
    telat: rows.filter((r) => r.state === "telat").length,
    belum: rows.filter((r) => r.state === "belum").length,
    total: staff.length,
  };
  return { rows, summary };
}
