import { describe, expect, test } from "vitest";
import { buildQueuedPayload } from "./queuePayload";
import type { AttendancePayload } from "./types";

const payload: AttendancePayload & { outlet_id: string } = {
  id: "11111111-1111-1111-1111-111111111111",
  outlet_staff_id: "staff-1",
  outlet_id: "jkt01",
  type: "in",
  gps_lat: -6.2,
  gps_lng: 106.84,
  gps_accuracy: 12,
  match_distance: 0,
  selfie_path: null,
  ts_client: "2026-06-09T09:03:00+07:00",
  from_queue: false,
};

describe("buildQueuedPayload", () => {
  // Regresi: kiosk meng-enqueue lewat `queue.enqueue(payload, dataUrl)` — tanpa
  // argumen outlet_id ketiga. Versi lama menimpa outlet_id payload dengan
  // `item.outlet_id || ''`, sehingga server membalas 403 cross_outlet dan
  // antrian MEMBUANG absen tersebut (4xx = drop). Absen offline hilang senyap.
  test("mempertahankan outlet_id dari payload saat item tak punya outlet_id", () => {
    const out = buildQueuedPayload({ payload, selfieDataUrl: "data:image/jpeg;base64,AAA" });
    expect(out.outlet_id).toBe("jkt01");
  });

  test("menandai from_queue dan melampirkan selfie base64", () => {
    const out = buildQueuedPayload({ payload, selfieDataUrl: "data:image/jpeg;base64,AAA" });
    expect(out.from_queue).toBe(true);
    expect(out.selfie_base64).toBe("data:image/jpeg;base64,AAA");
  });

  test("outlet_id eksplisit di item menang atas payload", () => {
    const out = buildQueuedPayload({ payload, selfieDataUrl: null, outlet_id: "bgr02" });
    expect(out.outlet_id).toBe("bgr02");
    expect(out.selfie_base64).toBeUndefined();
  });
});
