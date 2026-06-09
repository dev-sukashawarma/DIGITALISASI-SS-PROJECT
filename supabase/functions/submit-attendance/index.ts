import { createClient } from "@supabase/supabase-js";
import { haversineMeters } from "../_shared/haversine.ts";
import { computeStatus } from "./status.ts";

type Body = {
  id: string;
  outlet_staff_id: string;
  type: "in" | "out";
  gps_lat: number;
  gps_lng: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, reason: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client beridentitas caller (untuk auth.getUser); + admin client (service role) untuk tulis.
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, serviceKey);

  const { data: userData } = await userClient.auth.getUser();
  const callerId = userData.user?.id;
  if (!callerId) return json(401, { ok: false, reason: "unauthenticated" });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { ok: false, reason: "bad_json" }); }

  // Caller harus SPV/kepala_outlet (device login); ambil outlet_id caller.
  const { data: caller } = await admin
    .from("outlet_staff")
    .select("outlet_id, role")
    .eq("id", callerId).single();
  if (!caller) return json(403, { ok: false, reason: "caller_not_staff" });

  // Target staff harus se-outlet dengan caller & sudah enroll.
  const { data: target } = await admin
    .from("outlet_staff")
    .select("outlet_id, face_descriptor")
    .eq("id", body.outlet_staff_id).single();
  if (!target) return json(404, { ok: false, reason: "staff_not_found" });
  if (target.outlet_id !== caller.outlet_id) return json(403, { ok: false, reason: "cross_outlet" });
  if (!target.face_descriptor) return json(422, { ok: false, reason: "not_enrolled" });

  // Validasi path selfie milik outlet ini.
  if (body.selfie_path && !body.selfie_path.startsWith(`${caller.outlet_id}/`)) {
    return json(403, { ok: false, reason: "selfie_path_mismatch" });
  }

  // Lokasi outlet + config.
  const { data: outlet } = await admin
    .from("outlets").select("lat,lng").eq("id", caller.outlet_id).single();
  const { data: cfg } = await admin
    .from("outlet_attendance_config")
    .select("jam_masuk,toleransi_menit,radius_m")
    .eq("outlet_id", caller.outlet_id).single();
  if (!outlet || !cfg) return json(500, { ok: false, reason: "config_missing" });

  const distance = Math.round(
    haversineMeters({ lat: outlet.lat, lng: outlet.lng }, { lat: body.gps_lat, lng: body.gps_lng }),
  );
  if (distance > cfg.radius_m) {
    return json(200, { ok: false, reason: "outside_radius", distance_m: distance });
  }

  const tsServer = new Date().toISOString();
  const basis = body.from_queue ? body.ts_client : tsServer;
  const status = computeStatus(body.type, basis, cfg);

  // Insert idempoten (ON CONFLICT via upsert ignoreDuplicates).
  const { error } = await admin.from("attendance").upsert({
    id: body.id,
    outlet_staff_id: body.outlet_staff_id,
    outlet_id: caller.outlet_id,
    type: body.type,
    ts_server: tsServer,
    ts_client: body.ts_client,
    gps_lat: body.gps_lat,
    gps_lng: body.gps_lng,
    distance_m: distance,
    match_distance: body.match_distance,
    selfie_url: body.selfie_path,
    status,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return json(500, { ok: false, reason: "insert_failed", detail: error.message });

  return json(200, { ok: true, status, distance_m: distance, ts_server: tsServer, attendance_id: body.id });
});
