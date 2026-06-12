import { describe, it, expect } from "vitest";
import { computeBoard, type BoardStaff, type BoardRecord } from "./board";

const staff: BoardStaff[] = [
  { id: "1", name: "Budi", role: "crew" },
  { id: "2", name: "Sari", role: "kasir" },
  { id: "3", name: "Andi", role: "crew" },
];

const records: BoardRecord[] = [
  { outlet_staff_id: "1", type: "in", status: "tepat", ts_server: "2026-06-10T09:01:00+07:00" },
  { outlet_staff_id: "2", type: "in", status: "telat", ts_server: "2026-06-10T09:22:00+07:00" },
];

describe("computeBoard", () => {
  it("memetakan status & jam per staff", () => {
    const { rows } = computeBoard(staff, records);
    expect(rows.find(r => r.id === "1")?.state).toBe("masuk");
    expect(rows.find(r => r.id === "2")?.state).toBe("telat");
    expect(rows.find(r => r.id === "3")?.state).toBe("belum");
  });

  it("staff dengan in lalu out → keluar", () => {
    const { rows } = computeBoard(staff, [
      ...records,
      { outlet_staff_id: "1", type: "out", status: "tepat", ts_server: "2026-06-10T17:05:00+07:00" },
    ]);
    expect(rows.find(r => r.id === "1")?.state).toBe("keluar");
  });

  it("menghitung ringkasan", () => {
    const { summary } = computeBoard(staff, records);
    expect(summary).toEqual({ hadir: 2, telat: 1, belum: 1, total: 3 });
  });
});
