import { describe, expect, test, vi } from "vitest";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

const payload: AttendancePayload = {
  id: "11111111-1111-1111-1111-111111111111",
  outlet_staff_id: "staff-1",
  type: "in",
  gps_lat: -6.2, gps_lng: 106.84,
  match_distance: 0.38,
  selfie_path: "outlet-1/abc.jpg",
  ts_client: "2026-06-09T09:03:00+07:00",
  from_queue: false,
};

describe("submitAttendance", () => {
  test("mengirim POST ke endpoint function dengan auth dan mengembalikan hasil ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "tepat", distance_m: 12, ts_server: "x", attendance_id: payload.id }), { status: 200 }),
    );
    const res = await submitAttendance(payload, {
      functionUrl: "https://proj.supabase.co/functions/v1/submit-attendance",
      accessToken: "jwt-abc",
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(true);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toContain("/submit-attendance");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer jwt-abc" });
  });

  test("meneruskan hasil outside_radius apa adanya", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: "outside_radius", distance_m: 320 }), { status: 200 }),
    );
    const res = await submitAttendance(payload, {
      functionUrl: "u", accessToken: "t", fetchImpl: fetchMock,
    });
    expect(res).toEqual({ ok: false, reason: "outside_radius", distance_m: 320 });
  });
});
