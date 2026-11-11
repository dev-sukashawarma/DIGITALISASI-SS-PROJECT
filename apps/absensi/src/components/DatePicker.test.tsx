// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buatGridBulan, CalendarPanel, formatTanggalPendek, uraiIso } from "./DatePicker";
import { uraiJamMenit } from "./TimePicker";

describe("DatePicker & CalendarPanel helpers", () => {
  it("uraiIso memvalidasi tanggal kalender termasuk tahun kabisat", () => {
    expect(uraiIso("2026-11-11")).toEqual({ tahun: 2026, bulan0: 10, tgl: 11 });
    expect(uraiIso("2028-02-29")).toEqual({ tahun: 2028, bulan0: 1, tgl: 29 });
    expect(uraiIso("2026-02-29")).toBeNull();
    expect(uraiIso("bukan-tanggal")).toBeNull();
  });

  it("buatGridBulan menghasilkan 42 sel dimulai hari Senin tanpa geser zona waktu", () => {
    // November 2026: 1 Nov 2026 jatuh pada hari Minggu -> 6 hari Oktober di depannya (26-31 Okt)
    const grid = buatGridBulan(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ iso: "2026-10-26", tgl: 26, bulanIni: false });
    expect(grid[6]).toEqual({ iso: "2026-11-01", tgl: 1, bulanIni: true });
    expect(grid[35]).toEqual({ iso: "2026-11-30", tgl: 30, bulanIni: true });
    expect(grid[36]).toEqual({ iso: "2026-12-01", tgl: 1, bulanIni: false });
  });

  it("formatTanggalPendek menampilkan format ringkas bahasa Indonesia", () => {
    expect(formatTanggalPendek("2026-11-11")).toBe("11 Nov 2026");
  });
});

describe("CalendarPanel UI", () => {
  it("memilih tanggal custom tanpa ketergantungan native input[type=date]", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <CalendarPanel
        value="2026-11-12"
        today="2026-11-11"
        onChange={onChange}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "20 Nov 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-20");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("menonaktifkan tanggal di luar rentang min dan max", () => {
    const onChange = vi.fn();
    render(
      <CalendarPanel
        value="2026-11-15"
        today="2026-11-15"
        min="2026-11-10"
        max="2026-11-20"
        onChange={onChange}
      />
    );

    const sebelumMin = screen.getByRole("button", { name: "9 Nov 2026" }) as HTMLButtonElement;
    const sesudahMax = screen.getByRole("button", { name: "21 Nov 2026" }) as HTMLButtonElement;
    expect(sebelumMin.disabled).toBe(true);
    expect(sesudahMax.disabled).toBe(true);
  });
});

describe("TimePicker helpers", () => {
  it("uraiJamMenit menjaga format 24 jam dua digit", () => {
    expect(uraiJamMenit("09:05")).toEqual({ jam: "09", menit: "05" });
    expect(uraiJamMenit("23:45")).toEqual({ jam: "23", menit: "45" });
    expect(uraiJamMenit("")).toEqual({ jam: "09", menit: "00" });
  });
});
