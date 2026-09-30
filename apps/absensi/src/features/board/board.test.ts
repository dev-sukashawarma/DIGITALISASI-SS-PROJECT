import { describe, it, expect } from "vitest";
import { jamMasukBatasAlpha, jamMasukBatasAlphaStaf } from "./board";

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
