import { describe, it, expect } from "vitest";
import { petaPengecualian } from "./pengecualian";

const staf = [
  { id: "a", role: "crew" },
  { id: "b", role: "staff_pusat" },
  { id: "c", role: "crew" },
  { id: "d", role: "crew" },
];
const dasar = { tanggal: "2026-10-11", staf, cutiDisetujui: [], hariKerja: true, roleLiburKantor: ["staff_pusat"], rosterOff: new Set<string>() };

describe("petaPengecualian", () => {
  it("cuti disetujui yang mencakup tanggal → cuti dengan label jenis", () => {
    const m = petaPengecualian({ ...dasar, cutiDisetujui: [{ staff_id: "a", leave_type: "sick", start_date: "2026-10-10", end_date: "2026-10-12" }] });
    expect(m.get("a")).toEqual({ jenis: "cuti", keterangan: "Sakit" });
  });
  it("cuti di luar rentang diabaikan; jenis tak dikenal → 'Cuti'", () => {
    const m = petaPengecualian({
      ...dasar,
      cutiDisetujui: [
        { staff_id: "a", leave_type: "sick", start_date: "2026-10-12", end_date: "2026-10-13" },
        { staff_id: "c", leave_type: "zzz", start_date: "2026-10-11", end_date: "2026-10-11" },
      ],
    });
    expect(m.has("a")).toBe(false);
    expect(m.get("c")).toEqual({ jenis: "cuti", keterangan: "Cuti" });
  });
  it("Off roster → libur", () => {
    expect(petaPengecualian({ ...dasar, rosterOff: new Set(["d"]) }).get("d")).toEqual({ jenis: "libur", keterangan: "Off (roster)" });
  });
  it("hari libur hanya untuk role kantor; crew outlet tetap kerja", () => {
    const m = petaPengecualian({ ...dasar, hariKerja: false, namaHariLibur: "Maulid" });
    expect(m.get("b")).toEqual({ jenis: "libur", keterangan: "Maulid" });
    expect(m.has("a")).toBe(false);
    expect(petaPengecualian({ ...dasar, hariKerja: false }).get("b")!.keterangan).toBe("Hari libur");
  });
  it("prioritas: cuti > roster > hari libur", () => {
    const m = petaPengecualian({
      ...dasar,
      hariKerja: false,
      rosterOff: new Set(["b"]),
      cutiDisetujui: [{ staff_id: "b", leave_type: "annual", start_date: "2026-10-11", end_date: "2026-10-11" }],
    });
    expect(m.get("b")!.jenis).toBe("cuti");
    expect(petaPengecualian({ ...dasar, hariKerja: false, rosterOff: new Set(["b"]) }).get("b")!.keterangan).toBe("Off (roster)");
  });
});
