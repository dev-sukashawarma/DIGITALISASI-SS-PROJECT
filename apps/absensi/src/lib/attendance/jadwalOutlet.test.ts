import { describe, it, expect } from "vitest";
import { keOutletJadwal, keShiftDrafts, validasiShift, usulanShiftBaru } from "./jadwalOutlet";

describe("keOutletJadwal", () => {
  it("embed tabel (urutan, HH:MM:SS) → shift urut berjam HH:MM", () => {
    const j = keOutletJadwal({
      outlet_id: "o1",
      jam_masuk: "08:00:00",
      jam_keluar: "16:00:00",
      toleransi_menit: 10,
      absen_window_mode: "manual",
      pilih_shift_aktif: true,
      shifts: [
        { urutan: 2, nama: "Siang", jam_masuk: "12:00:00", jam_keluar: "20:00:00" },
        { urutan: 1, nama: null, jam_masuk: "08:00:00", jam_keluar: "16:00:00" },
      ],
    });
    expect(j).toEqual({
      outlet_id: "o1",
      jam_masuk: "08:00",
      jam_keluar: "16:00",
      toleransi_menit: 10,
      absen_window_mode: "manual",
      pilih_shift_aktif: true,
      shifts: [
        { ke: 1, nama: null, jam_masuk: "08:00", jam_keluar: "16:00" },
        { ke: 2, nama: "Siang", jam_masuk: "12:00", jam_keluar: "20:00" },
      ],
    });
  });

  it("baris lama tanpa daftar shift dibangun dari kolom cermin", () => {
    const j = keOutletJadwal({
      outlet_id: "o2",
      jam_masuk: "10:00",
      jam_keluar: "22:00",
      pilih_shift_aktif: false,
      shift2_jam_masuk: "13:00",
      shift2_jam_keluar: "23:00",
      shifts: [],
    });
    expect(j.shifts).toEqual([
      { ke: 1, nama: null, jam_masuk: "10:00", jam_keluar: "22:00" },
      { ke: 2, nama: null, jam_masuk: "13:00", jam_keluar: "23:00" },
    ]);
    expect(j.absen_window_mode).toBe("auto");
  });
});

describe("keShiftDrafts", () => {
  it("merapikan kiriman klien", () => {
    expect(keShiftDrafts([{ nama: "  Pagi ", jam_masuk: "08:00:00", jam_keluar: "16:00" }, null, "x"])).toEqual([
      { nama: "Pagi", jam_masuk: "08:00", jam_keluar: "16:00" },
    ]);
    expect(keShiftDrafts("bukan array")).toEqual([]);
  });
});

describe("validasiShift", () => {
  const s = (jam_masuk: string, jam_keluar: string, nama = "") => ({ nama, jam_masuk, jam_keluar });

  it("menerima satu shift tanpa pilihan shift, dan banyak shift dengan pilihan", () => {
    expect(validasiShift([s("08:00", "16:00")], false)).toBeNull();
    expect(validasiShift([s("08:00", "16:00"), s("16:00", "00:00"), s("22:00", "06:00")], true)).toBeNull();
  });

  it("menolak kosong, lebih dari 12, dan pilihan shift dengan satu shift", () => {
    expect(validasiShift([], false)).toMatch(/1–12/);
    expect(validasiShift(Array.from({ length: 13 }, (_, i) => s(`${String(i).padStart(2, "0")}:00`, "23:30")), true)).toMatch(/1–12/);
    expect(validasiShift([s("08:00", "16:00")], true)).toMatch(/minimal 2 shift/);
  });

  it("menolak jam kosong, jam sama, format salah, duplikat, dan nama terlalu panjang", () => {
    expect(validasiShift([s("", "16:00")], false)).toMatch(/Isi jam masuk/);
    expect(validasiShift([s("08:00", "08:00")], false)).toMatch(/tidak boleh sama/);
    expect(validasiShift([s("8:00", "16:00")], false)).toMatch(/Format jam/);
    expect(validasiShift([s("08:00", "16:00"), s("08:00", "16:00")], true)).toMatch(/sama persis/);
    expect(validasiShift([s("08:00", "16:00", "x".repeat(41))], false)).toMatch(/maksimal 40/);
  });
});

describe("usulanShiftBaru", () => {
  it("masuk = pulang shift terakhir, durasi sama", () => {
    expect(usulanShiftBaru([{ nama: "", jam_masuk: "08:00", jam_keluar: "16:00" }])).toEqual({ nama: "", jam_masuk: "16:00", jam_keluar: "00:00" });
    expect(usulanShiftBaru([{ nama: "", jam_masuk: "22:00", jam_keluar: "06:00" }])).toEqual({ nama: "", jam_masuk: "06:00", jam_keluar: "14:00" });
  });

  it("digeser bila jamnya sudah dipakai", () => {
    const penuh = [
      { nama: "", jam_masuk: "06:00", jam_keluar: "14:00" },
      { nama: "", jam_masuk: "14:00", jam_keluar: "22:00" },
      { nama: "", jam_masuk: "22:00", jam_keluar: "06:00" },
    ];
    expect(usulanShiftBaru(penuh)).toEqual({ nama: "", jam_masuk: "07:00", jam_keluar: "15:00" });
  });

  it("tanpa shift sebelumnya → 09:00–17:00", () => {
    expect(usulanShiftBaru([])).toEqual({ nama: "", jam_masuk: "09:00", jam_keluar: "17:00" });
  });
});
