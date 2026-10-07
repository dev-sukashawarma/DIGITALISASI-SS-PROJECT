import { describe, it, expect } from "vitest";
import { jamMasukBatasAlpha, jamMasukBatasAlphaStaf, computeBoard, type BoardConfig, type BoardRecord } from "./papan";

describe("jamMasukBatasAlpha", () => {
  const dasar = { jam_masuk: "08:00:00", toleransi_menit: 15 };

  it("tanpa pilihan shift → jam masuk outlet", () => {
    expect(jamMasukBatasAlpha({ ...dasar, shifts_jam_masuk: ["08:00", "16:00"] })).toBe("08:00");
    expect(jamMasukBatasAlpha({ ...dasar, pilih_shift_aktif: false, shift2_jam_masuk: "13:00:00" })).toBe("08:00");
  });

  it("berpilihan shift → jam masuk shift paling akhir dari seluruh daftar", () => {
    expect(jamMasukBatasAlpha({
      ...dasar,
      pilih_shift_aktif: true,
      shift2_jam_masuk: "12:00:00",
      shifts_jam_masuk: ["08:00:00", "12:00:00", "16:00:00"],
    })).toBe("16:00");
  });

  it("daftar shift kosong → cadangan kolom shift 2", () => {
    expect(jamMasukBatasAlpha({ ...dasar, pilih_shift_aktif: true, shift2_jam_masuk: "13:00:00", shifts_jam_masuk: [] })).toBe("13:00");
    expect(jamMasukBatasAlpha({ ...dasar, pilih_shift_aktif: true, shift2_jam_masuk: "13:00:00" })).toBe("13:00");
  });

  it("shift 2 lebih pagi dari jam outlet tidak memajukan batas", () => {
    expect(jamMasukBatasAlpha({ ...dasar, jam_masuk: "10:00", pilih_shift_aktif: true, shift2_jam_masuk: "06:00" })).toBe("10:00");
  });
});

describe("jamMasukBatasAlphaStaf", () => {
  const dasar = { jam_masuk: "08:00:00", toleransi_menit: 15 };

  it("staf berjadwal khusus memakai jam masuk aturannya", () => {
    expect(jamMasukBatasAlphaStaf(dasar, "15:00")).toBe("15:00");
    expect(jamMasukBatasAlphaStaf({ ...dasar, pilih_shift_aktif: true, shifts_jam_masuk: ["16:00"] }, "06:00:00")).toBe("06:00");
  });

  it("tanpa aturan → batas outlet", () => {
    expect(jamMasukBatasAlphaStaf(dasar, null)).toBe("08:00");
    expect(jamMasukBatasAlphaStaf({ ...dasar, pilih_shift_aktif: true, shifts_jam_masuk: ["08:00", "16:00"] })).toBe("16:00");
  });
});

describe("computeBoard", () => {
  const cfg: BoardConfig = { jam_masuk: "13:00:00", jam_keluar: "22:00:00", toleransi_menit: 15 };
  const staff = [
    { id: "a", name: "Andi", role: "crew" },
    { id: "b", name: "Budi", role: "crew" },
    { id: "c", name: "Cici", role: "crew" },
    { id: "d", name: "Dedi", role: "crew" },
  ];
  const rec = (r: Partial<BoardRecord> & Pick<BoardRecord, "outlet_staff_id" | "type" | "status" | "ts_server">): BoardRecord => r;
  const records = [
    rec({ outlet_staff_id: "a", type: "in", status: "tepat", ts_server: "2026-10-07T12:55:00+07:00" }),
    rec({ outlet_staff_id: "b", type: "in", status: "telat", ts_server: "2026-10-07T13:40:00+07:00", telat_menit: 40 }),
    rec({ outlet_staff_id: "c", type: "in", status: "tepat", ts_server: "2026-10-07T12:50:00+07:00" }),
    rec({ outlet_staff_id: "c", type: "out", status: "tepat", ts_server: "2026-10-07T22:01:00+07:00" }),
  ];

  it("batas alpha memakai WIB, bukan zona server", () => {
    // 13:10 WIB: Dedi belum lewat 13:15 → belum
    const sebelum = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-07T06:10:00Z"), tanggal: "2026-10-07" });
    expect(sebelum.rows.find((r) => r.id === "d")!.state).toBe("belum");
    // 13:16 WIB: lewat batas → alpha
    const sesudah = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-07T06:16:00Z"), tanggal: "2026-10-07" });
    expect(sesudah.rows.find((r) => r.id === "d")!.state).toBe("alpha");
  });

  it("tanggal lampau → yang tak absen selalu alpha; status & menit telat dari DB", () => {
    const { rows, summary } = computeBoard(staff, records, cfg, undefined, { sekarang: new Date("2026-10-08T01:00:00Z"), tanggal: "2026-10-07" });
    expect(rows.map((r) => [r.id, r.state])).toEqual([["a", "masuk"], ["b", "telat"], ["c", "keluar"], ["d", "alpha"]]);
    expect(rows.find((r) => r.id === "b")!.delay_minutes).toBe(40);
    expect(summary).toEqual({ hadir: 2, telat: 1, telat_toleransi: 0, belum: 0, alpha: 1, total: 4 });
  });

  it("jadwal khusus staf menggeser batas alpha staf itu saja", () => {
    const aturan = new Map([["d", "15:00"]]);
    const { rows } = computeBoard(staff, records, cfg, aturan, { sekarang: new Date("2026-10-07T07:00:00Z"), tanggal: "2026-10-07" });
    expect(rows.find((r) => r.id === "d")!.state).toBe("belum");
  });
});
