import { describe, it, expect } from "vitest";
import { tempatkanStaf, outletRumah } from "./papanGlobal";

const cakupan = [
  { id: "o-b", name: "Beji" },
  { id: "o-a", name: "Aria" },
  { id: "o-c", name: "Cibubur" },
];
const rec = (staf: string, outlet: string, type: "in" | "out", ts: string) => ({
  outlet_staff_id: staf, outlet_id: outlet, type, status: "tepat" as const, ts_server: ts,
});
const s = (id: string, utama: string | null, tambahan: string[] = []) => ({ id, name: id, role: "crew", outletUtama: utama, outletTambahan: tambahan });

describe("outletRumah", () => {
  it("outlet utama dalam cakupan", () => expect(outletRumah(s("x", "o-b", ["o-a"]), cakupan)).toBe("o-b"));
  it("utama di luar cakupan → tambahan pertama menurut nama", () => expect(outletRumah(s("x", "gudang", ["o-c", "o-b", "o-a"]), cakupan)).toBe("o-a"));
  it("tak ada yang dalam cakupan → null", () => expect(outletRumah(s("x", "gudang", ["zz"]), cakupan)).toBeNull());
  it("utama null", () => expect(outletRumah(s("x", null, ["o-c"]), cakupan)).toBe("o-c"));
});

describe("tempatkanStaf", () => {
  it("crew normal: tampil di outlet utama dengan catatannya", () => {
    const m = tempatkanStaf([s("c1", "o-a")], [rec("c1", "o-a", "in", "2026-10-07T01:00:00Z")], cakupan);
    expect(m.get("o-a")?.staf.map((x) => x.id)).toEqual(["c1"]);
    expect(m.get("o-a")?.records).toHaveLength(1);
    expect(m.get("o-b")?.staf ?? []).toHaveLength(0);
  });

  it("leader 30 outlet yang absen di luar tampil sekali, di outlet record 'in' pertama", () => {
    const tambahan = ["o-a", "o-b", "o-c"];
    const m = tempatkanStaf([s("L", "gudang", tambahan)], [rec("L", "o-c", "in", "2026-10-07T01:00:00Z")], cakupan);
    const hitung = [...m.values()].filter((v) => v.staf.some((x) => x.id === "L")).length;
    expect(hitung).toBe(1);
    expect(m.get("o-c")?.staf.map((x) => x.id)).toEqual(["L"]);
  });

  it("record di luar cakupan (gudang) → ditempatkan di rumah, record tetap dibawa (hadir)", () => {
    const m = tempatkanStaf([s("L", "gudang", ["o-b", "o-a"])], [rec("L", "gudang", "in", "2026-10-07T01:00:00Z")], cakupan);
    const lokasi = [...m.entries()].filter(([, v]) => v.staf.some((x) => x.id === "L"));
    expect(lokasi).toHaveLength(1);
    expect(lokasi[0][0]).toBe("o-a");
    expect(lokasi[0][1].records).toHaveLength(1);
  });

  it("absen tanpa record → di outlet rumah sekali", () => {
    const m = tempatkanStaf([s("L", "o-b", ["o-a", "o-c"])], [], cakupan);
    expect([...m.values()].filter((v) => v.staf.length).length).toBe(1);
    expect(m.get("o-b")?.staf).toHaveLength(1);
  });

  it("record 'in' pertama menentukan outlet meski ada record lain belakangan", () => {
    const m = tempatkanStaf(
      [s("L", "o-b", ["o-a"])],
      [rec("L", "o-a", "in", "2026-10-07T01:00:00Z"), rec("L", "o-b", "out", "2026-10-07T09:00:00Z")],
      cakupan,
    );
    expect(m.get("o-a")?.staf.map((x) => x.id)).toEqual(["L"]);
    expect(m.get("o-b")?.staf ?? []).toHaveLength(0);
    expect(m.get("o-a")?.records.map((r) => r.type)).toEqual(["in", "out"]);
  });

  it("staf tanpa outlet dalam cakupan dilewati", () => {
    const m = tempatkanStaf([s("z", "gudang", [])], [], cakupan);
    expect([...m.values()].every((v) => v.staf.length === 0)).toBe(true);
  });
});
