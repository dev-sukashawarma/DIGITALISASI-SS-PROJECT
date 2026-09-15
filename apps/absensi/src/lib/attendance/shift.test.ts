import { describe, it, expect } from "vitest";
import { shiftOptions, namaShift, isShiftKe } from "./shift";

const bnr = {
  jam_masuk: "08:00:00",
  jam_keluar: "17:00:00",
  pilih_shift_aktif: true,
  shift2_jam_masuk: "13:00:00",
  shift2_jam_keluar: "22:00:00",
};

describe("shiftOptions", () => {
  it("mengembalikan dua shift berformat HH:MM saat toggle aktif", () => {
    expect(shiftOptions(bnr)).toEqual([
      { ke: 1, jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, jam_masuk: "13:00", jam_keluar: "22:00" },
    ]);
  });

  it("null saat toggle mati (outlet satu shift)", () => {
    expect(shiftOptions({ ...bnr, pilih_shift_aktif: false })).toBeNull();
  });

  it("null saat config kosong", () => {
    expect(shiftOptions(null)).toBeNull();
    expect(shiftOptions(undefined)).toBeNull();
  });

  it("null saat jam shift 2 belum lengkap — jangan tampilkan pilihan setengah jadi", () => {
    expect(shiftOptions({ ...bnr, shift2_jam_keluar: null })).toBeNull();
  });
});

describe("namaShift", () => {
  it("memberi sebutan dari jam masuk", () => {
    expect(namaShift("08:00")).toBe("Shift Pagi");
    expect(namaShift("13:00")).toBe("Shift Siang");
    expect(namaShift("17:00")).toBe("Shift Malam");
  });
});

describe("isShiftKe", () => {
  it("hanya menerima 1 atau 2", () => {
    expect(isShiftKe(1)).toBe(true);
    expect(isShiftKe(2)).toBe(true);
    expect(isShiftKe("1")).toBe(false);
    expect(isShiftKe(3)).toBe(false);
    expect(isShiftKe(undefined)).toBe(false);
  });
});
