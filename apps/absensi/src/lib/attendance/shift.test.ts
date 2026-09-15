import { describe, it, expect } from "vitest";
import { shiftOptions, namaShift, isShiftKe, isShiftPenutup } from "./shift";

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

describe("isShiftPenutup", () => {
  const opsi = shiftOptions(bnr);

  it("shift yang pulang paling akhir (22:00) = penutup", () => {
    expect(isShiftPenutup(opsi, "22:00")).toBe(true);
    expect(isShiftPenutup(opsi, "22:00:00")).toBe(true);
  });

  it("shift yang pulang lebih awal (17:00) bukan penutup", () => {
    expect(isShiftPenutup(opsi, "17:00")).toBe(false);
  });

  it("outlet satu shift atau tanpa jejak shift → dianggap penutup (aturan lama)", () => {
    expect(isShiftPenutup(null, "17:00")).toBe(true);
    expect(isShiftPenutup(opsi, null)).toBe(true);
  });

  it("shift lewat tengah malam (18:00–02:00) lebih akhir daripada 10:00–22:00", () => {
    const malam = shiftOptions({ jam_masuk: "10:00", jam_keluar: "22:00", pilih_shift_aktif: true, shift2_jam_masuk: "18:00", shift2_jam_keluar: "02:00" });
    expect(isShiftPenutup(malam, "02:00")).toBe(true);
    expect(isShiftPenutup(malam, "22:00")).toBe(false);
  });
});
