export type AttendanceType = "in" | "out";

export type AttendancePayload = {
  id: string;                 // UUID client (idempotency)
  outlet_staff_id: string;
  type: AttendanceType;
  gps_lat: number;
  gps_lng: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

export type SubmitResult =
  | { ok: true; status: "tepat" | "telat"; distance_m: number; ts_server: string; attendance_id: string }
  | { ok: false; reason: string; distance_m?: number };
