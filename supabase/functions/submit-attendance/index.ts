import { createClient } from "@supabase/supabase-js";
import { computeStatus } from "./status.ts";

type Body = {
  id: string;
  outlet_staff_id: string;
  type: "in" | "out";
  gps_lat?: number;
  gps_lng?: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, reason: "method_not_allowed" });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin client (service role) untuk validasi token & tulis data.
    const admin = createClient(url, serviceKey);

    let body: Body & { outlet_id: string };
    try { body = await req.json(); } catch { return json(400, { ok: false, reason: "bad_json" }); }

    // Target staff harus terdaftar & sesuai dengan outlet_id
    const { data: target } = await admin
      .from("outlet_staff")
      .select("outlet_id, face_descriptor")
      .eq("id", body.outlet_staff_id).single();
    if (!target) return json(404, { ok: false, reason: "staff_not_found" });
    if (target.outlet_id !== body.outlet_id) return json(403, { ok: false, reason: "cross_outlet" });
    if (!target.face_descriptor) return json(422, { ok: false, reason: "not_enrolled" });

    // Validasi path selfie milik outlet ini.
    if (body.selfie_path && !body.selfie_path.startsWith(`${body.outlet_id}/`)) {
      return json(403, { ok: false, reason: "selfie_path_mismatch" });
    }

    // Config jam kerja (tanpa GPS/radius — absensi di device outlet).
    const { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,jam_keluar,toleransi_menit")
      .eq("outlet_id", body.outlet_id).single();
    if (!cfg) return json(500, { ok: false, reason: "config_missing" });

    const tsServer = new Date().toISOString();
    const basis = body.from_queue ? body.ts_client : tsServer;
    const status = computeStatus(body.type, basis, cfg);

    // Insert idempoten (ON CONFLICT via upsert ignoreDuplicates).
    const { error } = await admin.from("attendance").upsert({
      id: body.id,
      outlet_staff_id: body.outlet_staff_id,
      outlet_id: body.outlet_id,
      type: body.type,
      ts_server: tsServer,
      ts_client: body.ts_client,
      gps_lat: null,
      gps_lng: null,
      distance_m: null,
      match_distance: body.match_distance,
      selfie_url: body.selfie_path,
      status,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) return json(500, { ok: false, reason: "insert_failed", detail: error.message });

    if (status === "alpha" && body.type === "in") {
      return json(200, { ok: false, reason: "terlambat_alpha", ts_server: tsServer, attendance_id: body.id });
    }

    return json(200, { ok: true, status, ts_server: tsServer, attendance_id: body.id });
  } catch (_e) {
    return json(500, { ok: false, reason: "internal_error" });
  }
});
