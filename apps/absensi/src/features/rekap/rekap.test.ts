import { describe, it, expect } from "vitest";

function formatStatusText(status: string) {
  switch (status) {
    case "telat": return "Masuk Telat";
    case "telat_toleransi": return "Telat (Toleransi)";
    case "lebih_awal": return "Pulang Cepat";
    case "pulang_telat": return "Pulang Lambat";
    case "tepat": return "Tepat Waktu";
    case "alpha": return "Alpha";
    default: return status;
  }
}

describe("formatStatusText", () => {
  it("maps pulang_telat to 'Pulang Lambat'", () => {
    expect(formatStatusText("pulang_telat")).toBe("Pulang Lambat");
  });

  it("maps lebih_awal to 'Pulang Cepat'", () => {
    expect(formatStatusText("lebih_awal")).toBe("Pulang Cepat");
  });

  it("maps telat to 'Masuk Telat'", () => {
    expect(formatStatusText("telat")).toBe("Masuk Telat");
  });

  it("maps tepat to 'Tepat Waktu'", () => {
    expect(formatStatusText("tepat")).toBe("Tepat Waktu");
  });

  it("maps alpha to 'Alpha'", () => {
    expect(formatStatusText("alpha")).toBe("Alpha");
  });
});

describe("Rekap calculation logic", () => {
  type Row = {
    outlet_staff_id: string;
    type: "in" | "out";
    status: "tepat" | "telat" | "telat_toleransi" | "alpha" | "lebih_awal" | "pulang_telat";
    ts_server: string;
    selfie_url: string | null;
    delay_minutes?: number | null;
  };

  function computeStaffSummary(staffId: string, staffName: string, rows: Row[]) {
    const s = {
      staff_id: staffId,
      name: staffName,
      total_masuk: 0,
      total_telat: 0,
      total_telat_toleransi: 0,
      total_alpha: 0,
      total_cepat: 0,
      total_pulang_lambat: 0,
      latest_photo_url: null as string | null,
      in_photo_url: null as string | null,
      latest_in: null as Row | null,
      latest_out: null as Row | null,
      rows: [] as Row[],
    };

    rows.forEach((r) => {
      s.rows.push(r);
      if (r.selfie_url && !s.latest_photo_url) s.latest_photo_url = r.selfie_url;
      if (r.type === "in" && r.selfie_url && !s.in_photo_url) s.in_photo_url = r.selfie_url;
      if (r.type === "in" && r.status !== "alpha" && !s.latest_in) s.latest_in = r;
      if (r.type === "out" && !s.latest_out) s.latest_out = r;
    });

    const dayGroups = new Map<string, { in?: Row; out?: Row; alpha?: Row }>();
    s.rows.forEach((r) => {
      const dStr = r.ts_server.split("T")[0];
      const existing = dayGroups.get(dStr) || {};
      if (r.status === "alpha") existing.alpha = r;
      else if (r.type === "in") existing.in = r;
      else if (r.type === "out") existing.out = r;
      dayGroups.set(dStr, existing);
    });

    dayGroups.forEach((day) => {
      if (day.in) {
        s.total_masuk++;
        if (day.in.status === "telat") s.total_telat++;
        else if (day.in.status === "telat_toleransi") s.total_telat_toleransi++;
      } else if (day.out) {
        s.total_masuk++;
      } else if (day.alpha) {
        s.total_alpha++;
      }

      if (day.out) {
        if (day.out.status === "lebih_awal") s.total_cepat++;
        else if (day.out.status === "pulang_telat") s.total_pulang_lambat++;
      }
    });

    return s;
  }

  it("correctly counts late check-in with silent photo and does not falsely count as alpha", () => {
    const rows: Row[] = [
      {
        outlet_staff_id: "staff-1",
        type: "in",
        status: "telat",
        ts_server: "2026-09-18T08:15:00+07:00",
        selfie_url: "selfies/staff-1-in.jpg",
        delay_minutes: 15,
      },
    ];

    const summary = computeStaffSummary("staff-1", "Budi", rows);
    expect(summary.total_masuk).toBe(1);
    expect(summary.total_telat).toBe(1);
    expect(summary.total_alpha).toBe(0);
    expect(summary.in_photo_url).toBe("selfies/staff-1-in.jpg");
    expect(summary.latest_in?.status).toBe("telat");
  });

  it("handles late check-out without check-in without inflating check-in lateness or alpha", () => {
    const rows: Row[] = [
      {
        outlet_staff_id: "staff-2",
        type: "out",
        status: "pulang_telat",
        ts_server: "2026-09-18T22:28:00+07:00",
        selfie_url: "selfies/staff-2-out.jpg",
        delay_minutes: 28,
      },
    ];

    const summary = computeStaffSummary("staff-2", "Abdurrohman", rows);
    expect(summary.total_masuk).toBe(1);
    expect(summary.total_telat).toBe(0);
    expect(summary.total_pulang_lambat).toBe(1);
    expect(summary.total_alpha).toBe(0);
    expect(summary.latest_in).toBeNull();
    expect(summary.latest_out?.status).toBe("pulang_telat");
  });

  it("correctly labels early check-out as total_cepat", () => {
    const rows: Row[] = [
      {
        outlet_staff_id: "staff-3",
        type: "in",
        status: "tepat",
        ts_server: "2026-09-18T07:55:00+07:00",
        selfie_url: "selfies/staff-3-in.jpg",
      },
      {
        outlet_staff_id: "staff-3",
        type: "out",
        status: "lebih_awal",
        ts_server: "2026-09-18T16:00:00+07:00",
        selfie_url: null,
        delay_minutes: 60,
      },
    ];

    const summary = computeStaffSummary("staff-3", "Citra", rows);
    expect(summary.total_masuk).toBe(1);
    expect(summary.total_telat).toBe(0);
    expect(summary.total_cepat).toBe(1);
    expect(summary.total_pulang_lambat).toBe(0);
    expect(summary.total_alpha).toBe(0);
  });
});
