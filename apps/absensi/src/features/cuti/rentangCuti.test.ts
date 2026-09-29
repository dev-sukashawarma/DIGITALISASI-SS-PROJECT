import { describe, it, expect } from "vitest";
import {
  hitungRentang,
  pengajuanBentrok,
  cutiTerpakaiTahun,
  hariMenunggu,
  hariIniLokal,
  maksHari,
  type BarisCuti,
} from "./rentangCuti";

const row = (start_date: string, end_date: string, status = "pending", days = 1, status_spv: string | null = "pending"): BarisCuti => ({
  id: `${start_date}-${status}`,
  leave_type: "annual",
  start_date,
  end_date,
  days,
  status,
  status_spv,
});

describe("hitungRentang", () => {
  it("satu hari selesai di hari yang sama dan masuk besoknya", () => {
    const r = hitungRentang("2026-09-28", 1);
    expect(r.selesai).toBe("2026-09-28");
    expect(r.masukKembali).toBe("2026-09-29");
    expect(r.tanggal).toEqual(["2026-09-28"]);
  });

  it("hari dihitung inklusif termasuk akhir pekan", () => {
    const r = hitungRentang("2026-10-02", 3); // Jumat
    expect(r.selesai).toBe("2026-10-04");
    expect(r.masukKembali).toBe("2026-10-05");
  });

  it("melewati akhir bulan, tahun, dan 29 Februari", () => {
    expect(hitungRentang("2026-12-30", 4).selesai).toBe("2027-01-02");
    expect(hitungRentang("2028-02-28", 2).selesai).toBe("2028-02-29");
  });

  it("nol hari atau pecahan ditolak", () => {
    expect(() => hitungRentang("2026-09-28", 0)).toThrow();
    expect(() => hitungRentang("2026-09-28", 1.5)).toThrow();
  });
});

describe("pengajuanBentrok", () => {
  const r = hitungRentang("2026-09-28", 3); // 28–30 Sep

  it("bentrok dengan pengajuan menunggu atau disetujui yang beririsan", () => {
    expect(pengajuanBentrok(r, [row("2026-09-30", "2026-10-02")])).not.toBeNull();
    expect(pengajuanBentrok(r, [row("2026-09-25", "2026-09-28", "approved")])).not.toBeNull();
  });

  it("tidak bentrok bila bersebelahan, ditolak HR, atau ditolak SPV", () => {
    expect(pengajuanBentrok(r, [row("2026-10-01", "2026-10-03")])).toBeNull();
    expect(pengajuanBentrok(r, [row("2026-09-25", "2026-09-27")])).toBeNull();
    expect(pengajuanBentrok(r, [row("2026-09-29", "2026-09-29", "rejected")])).toBeNull();
    expect(pengajuanBentrok(r, [row("2026-09-29", "2026-09-29", "pending", 1, "rejected")])).toBeNull();
  });

  it("baris tanggal rusak diabaikan", () => {
    expect(pengajuanBentrok(r, [row("-", "-")])).toBeNull();
  });
});

describe("ringkasan kuota", () => {
  const riwayat = [
    row("2026-02-01", "2026-02-03", "approved", 3),
    row("2026-07-01", "2026-07-02", "pending", 2),
    row("2026-08-01", "2026-08-01", "rejected", 1),
    row("2026-08-05", "2026-08-05", "pending", 1, "rejected"),
    row("2025-12-30", "2026-01-02", "approved", 4),
  ];

  it("terpakai hanya yang disetujui pada tahun berjalan", () => {
    expect(cutiTerpakaiTahun(riwayat, 2026)).toBe(3);
    expect(cutiTerpakaiTahun(riwayat, 2025)).toBe(4);
  });

  it("menunggu tidak termasuk yang sudah ditolak SPV", () => {
    expect(hariMenunggu(riwayat)).toBe(2);
  });
});

it("hariIniLokal memakai tanggal lokal, bukan UTC", () => {
  expect(hariIniLokal(new Date(2026, 8, 29, 0, 30))).toBe("2026-09-29");
});

it("cuti melahirkan boleh lebih panjang", () => {
  expect(maksHari("maternity")).toBe(90);
  expect(maksHari("annual")).toBe(30);
});
