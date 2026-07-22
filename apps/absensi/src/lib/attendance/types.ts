export type AttendanceType = "in" | "out";

export type AttendancePayload = {
  id: string;                 // UUID client (idempotency)
  outlet_staff_id: string;
  type: AttendanceType;
  gps_lat?: number | null;
  gps_lng?: number | null;
  gps_accuracy?: number | null;
  is_mock?: boolean;
  match_distance: number;
  selfie_path: string | null;
  selfie_base64?: string;     // Optional: base64 data when syncing from offline queue
  ts_client: string;
  from_queue: boolean;
};

export type SubmitResult =
  | { ok: true; status: "tepat" | "telat"; ts_server: string; attendance_id: string }
  | { ok: false; reason: string; distance_m?: number };
