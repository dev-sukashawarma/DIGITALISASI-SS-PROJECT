import { describe, it, expect } from "vitest";
import { shiftOptions, namaShift, isShiftKe, isShiftPenutup, keShiftRows, DRIVER_SHIFT_KE } from "./shift";

// Data lama: dua kolom datar tanpa daftar shift (cadangan).
const bnr = {
  jam_masuk: "08:00:00",
  jam_keluar: "17:00:00",
  pilih_shift_aktif: true,
  shift2_jam_masuk: "13:00:00",
  shift2_jam_keluar: "22:00:00",
};

// Data baru: daftar shift dari RPC (cermin kolom lama tetap ikut terkirim).
const tigaShift = {
  ...bnr,
  shifts: [
    { ke: 1, nama: null, jam_masuk: "07:00", jam_keluar: "15:00" },
    { ke: 2, nama: "Tengah", jam_masuk: "11:00", jam_keluar: "19:00" },
    { ke: 3, nama: null, jam_masuk: "15:00", jam_keluar: "23:00" },
  ],
};

describe("shiftOptions", () => {
  it("cadangan kolom lama: dua shift berformat HH:MM saat toggle aktif untuk crew biasa", () => {
    expect(shiftOptions(bnr)).toEqual([
      { ke: 1, nama: "Shift Pagi", jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, nama: "Shift Siang", jam_masuk: "13:00", jam_keluar: "22:00" },
    ]);
  });

  it("driver mendapat tambahan Shift Driver 09:00–18:00 bernomor 99", () => {
    expect(shiftOptions(bnr, "driver")).toEqual([
      { ke: 1, nama: "Shift Pagi", jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, nama: "Shift Siang", jam_masuk: "13:00", jam_keluar: "22:00" },
      { ke: DRIVER_SHIFT_KE, nama: "Shift Driver", jam_masuk: "09:00", jam_keluar: "18:00" },
    ]);
  });

  it("memakai daftar shift (3+) bila ada, mengabaikan kolom lama", () => {
    expect(shiftOptions(tigaShift)).toEqual([
      { ke: 1, nama: "Shift Pagi", jam_masuk: "07:00", jam_keluar: "15:00" },
      { ke: 2, nama: "Tengah", jam_masuk: "11:00", jam_keluar: "19:00" },
      { ke: 3, nama: "Shift Malam", jam_masuk: "15:00", jam_keluar: "23:00" },
    ]);
  });

  it("nama khusus dipakai apa adanya (tanpa spasi tepi), kosong jatuh ke sebutan otomatis", () => {
    const opsi = shiftOptions({
      pilih_shift_aktif: true,
      shifts: [
        { ke: 1, nama: "  Opening  ", jam_masuk: "08:00", jam_keluar: "16:00" },
        { ke: 2, nama: "", jam_masuk: "16:00", jam_keluar: "23:59" },
      ],
    });
    expect(opsi?.map((o) => o.nama)).toEqual(["Opening", "Shift Malam"]);
  });

  it("urut menurut nomor shift walau data datang acak", () => {
    const opsi = shiftOptions({
      pilih_shift_aktif: true,
      shifts: [
        { ke: 3, nama: null, jam_masuk: "18:00", jam_keluar: "02:00" },
        { ke: 1, nama: null, jam_masuk: "08:00", jam_keluar: "16:00" },
        { ke: 2, nama: null, jam_masuk: "12:00", jam_keluar: "20:00" },
      ],
    });
    expect(opsi?.map((o) => o.ke)).toEqual([1, 2, 3]);
  });

  it("null bila daftar shift hanya satu — server pun tidak meminta pilihan", () => {
    expect(shiftOptions({ pilih_shift_aktif: true, shifts: [{ ke: 1, nama: null, jam_masuk: "08:00", jam_keluar: "17:00" }] })).toBeNull();
    expect(shiftOptions({ pilih_shift_aktif: true, shifts: [{ ke: 1, nama: null, jam_masuk: "08:00", jam_keluar: "17:00" }] }, "driver")).toBeNull();
  });

  it("null saat toggle mati (outlet satu shift)", () => {
    expect(shiftOptions({ ...bnr, pilih_shift_aktif: false })).toBeNull();
    expect(shiftOptions({ ...tigaShift, pilih_shift_aktif: false }, "driver")).toBeNull();
  });

  it("null saat config kosong", () => {
    expect(shiftOptions(null)).toBeNull();
    expect(shiftOptions(undefined)).toBeNull();
  });

  it("cadangan kolom lama: null saat jam shift 2 belum lengkap — jangan tampilkan pilihan setengah jadi", () => {
    expect(shiftOptions({ ...bnr, shift2_jam_keluar: null })).toBeNull();
    expect(shiftOptions({ ...bnr, shift2_jam_keluar: null, shifts: [] })).toBeNull();
  });
});

describe("keShiftRows", () => {
  it("menerima bentuk embed tabel (urutan, HH:MM:SS) dan membuang baris rusak", () => {
    expect(keShiftRows([
      { urutan: 2, nama: null, jam_masuk: "13:00:00", jam_keluar: "22:00:00" },
      { urutan: 1, nama: " Pagi ", jam_masuk: "08:00:00", jam_keluar: "17:00:00" },
      { urutan: 3, nama: null, jam_masuk: null, jam_keluar: "17:00:00" },
    ])).toEqual([
      { ke: 1, nama: "Pagi", jam_masuk: "08:00", jam_keluar: "17:00" },
      { ke: 2, nama: null, jam_masuk: "13:00", jam_keluar: "22:00" },
    ]);
    expect(keShiftRows(null)).toEqual([]);
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
  it("menerima bilangan bulat 1–12 dan nomor shift driver", () => {
    expect(isShiftKe(1)).toBe(true);
    expect(isShiftKe(2)).toBe(true);
    expect(isShiftKe(3)).toBe(true);
    expect(isShiftKe(12)).toBe(true);
    expect(isShiftKe(DRIVER_SHIFT_KE)).toBe(true);
  });

  it("menolak selain itu", () => {
    expect(isShiftKe("1")).toBe(false);
    expect(isShiftKe(0)).toBe(false);
    expect(isShiftKe(13)).toBe(false);
    expect(isShiftKe(1.5)).toBe(false);
    expect(isShiftKe(undefined)).toBe(false);
    expect(isShiftKe(null)).toBe(false);
  });
});

describe("isShiftPenutup", () => {
  const opsi = shiftOptions(bnr);
  const opsiDriver = shiftOptions(bnr, "driver");

  it("Shift Driver (18:00) bukan penutup", () => {
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

  it("jejak shift yang tidak ada lagi di daftar → dianggap penutup", () => {
    expect(isShiftPenutup(opsi, "20:00")).toBe(true);
  });

  it("shift lewat tengah malam (18:00–02:00) lebih akhir daripada 10:00–22:00", () => {
    const malam = shiftOptions({ jam_masuk: "10:00", jam_keluar: "22:00", pilih_shift_aktif: true, shift2_jam_masuk: "18:00", shift2_jam_keluar: "02:00" });
    expect(isShiftPenutup(malam, "02:00")).toBe(true);
    expect(isShiftPenutup(malam, "22:00")).toBe(false);
  });

  it("tiga shift: hanya yang pulang paling akhir yang menutup", () => {
    const o = shiftOptions(tigaShift);
    expect(isShiftPenutup(o, "15:00")).toBe(false);
    expect(isShiftPenutup(o, "19:00")).toBe(false);
    expect(isShiftPenutup(o, "23:00")).toBe(true);
  });

  it("tiga shift dengan shift malam lewat tengah malam sebagai penutup", () => {
    const o = shiftOptions({
      pilih_shift_aktif: true,
      shifts: [
        { ke: 1, nama: null, jam_masuk: "08:00", jam_keluar: "16:00" },
        { ke: 2, nama: null, jam_masuk: "14:00", jam_keluar: "22:00" },
        { ke: 3, nama: null, jam_masuk: "22:00", jam_keluar: "06:00" },
      ],
    });
    expect(isShiftPenutup(o, "06:00", "22:00")).toBe(true);
    expect(isShiftPenutup(o, "22:00", "14:00")).toBe(false);
    expect(isShiftPenutup(o, "16:00")).toBe(false);
  });

  it("Shift Driver tidak ikut menentukan batas penutup", () => {
    // Semua shift outlet pulang 17:00 paling lambat; Shift Driver (18:00) lebih akhir
    // tapi tidak boleh membuat shift 17:00 kehilangan status penutup.
    const o = shiftOptions({
      pilih_shift_aktif: true,
      shifts: [
        { ke: 1, nama: null, jam_masuk: "06:00", jam_keluar: "12:00" },
        { ke: 2, nama: null, jam_masuk: "11:00", jam_keluar: "17:00" },
      ],
    }, "driver");
    expect(isShiftPenutup(o, "17:00")).toBe(true);
    expect(isShiftPenutup(o, "12:00")).toBe(false);
    // Sama dengan server (>=): driver yang pulang setelah shift outlet terakhir ikut menutup.
    expect(isShiftPenutup(o, "18:00")).toBe(true);
  });

  it("jam masuk jejak absen membedakan dua shift berjam pulang sama", () => {
    const o = shiftOptions({
      pilih_shift_aktif: true,
      shifts: [
        { ke: 1, nama: null, jam_masuk: "22:00", jam_keluar: "06:00" },
        { ke: 2, nama: null, jam_masuk: "00:00", jam_keluar: "06:00" },
      ],
    });
    expect(isShiftPenutup(o, "06:00", "22:00")).toBe(true);
    expect(isShiftPenutup(o, "06:00", "00:00")).toBe(false);
  });
});
