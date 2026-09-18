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
  it("mengembalikan dua shift berformat HH:MM saat toggle aktif untuk crew biasa", () => {
    expect(shiftOptions(bnr)).toEqual([
      { ke: 1, jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, jam_masuk: "13:00", jam_keluar: "22:00" },
    ]);
  });

  it("mengembalikan tiga shift (termasuk 09:00-18:00) khusus untuk role driver", () => {
    expect(shiftOptions(bnr, "driver")).toEqual([
      { ke: 1, jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, jam_masuk: "13:00", jam_keluar: "22:00" },
      { ke: 3, jam_masuk: "09:00", jam_keluar: "18:00" },
    ]);
  });

  it("null saat toggle mati (outlet satu shift)", () => {
    expect(shiftOptions({ ...bnr, pilih_shift_aktif: false })).toBeNull();
    expect(shiftOptions({ ...bnr, pilih_shift_aktif: false }, "driver")).toBeNull();
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
    expect(namaShift("09:00")).toBe("Shift Pagi");
    expect(namaShift("13:00")).toBe("Shift Siang");
    expect(namaShift("17:00")).toBe("Shift Malam");
  });
});

describe("isShiftKe", () => {
  it("menerima 1, 2, atau 3", () => {
    expect(isShiftKe(1)).toBe(true);
    expect(isShiftKe(2)).toBe(true);
    expect(isShiftKe(3)).toBe(true);
    expect(isShiftKe("1")).toBe(false);
    expect(isShiftKe(4)).toBe(false);
    expect(isShiftKe(undefined)).toBe(false);
  });
});

describe("isShiftPenutup", () => {
  const opsi = shiftOptions(bnr);
  const opsiDriver = shiftOptions(bnr, "driver");

  it("shift 3 driver (18:00) bukan penutup", () => {
    expect(isShiftPenutup(opsiDriver, "18:00")).toBe(false);
    expect(isShiftPenutup(opsiDriver, "18:00:00")).toBe(false);
  });

  it("shift yang pulang paling akhir (22:00) = penutup", () => {
    expect(isShiftPenutup(opsiDriver, "22:00")).toBe(true);
    expect(isShiftPenutup(opsiDriver, "22:00:00")).toBe(true);
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
