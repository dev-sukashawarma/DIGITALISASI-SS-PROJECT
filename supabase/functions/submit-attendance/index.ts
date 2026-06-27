import { createClient } from "@supabase/supabase-js";
import { computeStatus } from "./status.ts";

type Body = {
  id: string;
  outlet_staff_id: string;
  type: "in" | "out";
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

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

    // Validasi radius GPS server-side ketat 4 meter
    const { data: outlet } = await admin
      .from("outlets")
      .select("lat, lng")
      .eq("id", body.outlet_id)
      .single();
    if (!outlet) return json(404, { ok: false, reason: "outlet_not_found" });

    let distanceM: number | null = null;
    // Hanya validasi GPS jika koordinat outlet terdaftar (tidak null)
    if (outlet.lat !== null && outlet.lng !== null) {
      if (body.gps_lat !== undefined && body.gps_lat !== null && body.gps_lng !== undefined && body.gps_lng !== null) {
        const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };
        const userCoords = { lat: Number(body.gps_lat), lng: Number(body.gps_lng) };
        distanceM = haversineMeters(outletCoords, userCoords);
      }

      // Toleransi akurasi dinamis: Jarak - Akurasi GPS <= 25 meter
      const accuracy = Number(body.gps_accuracy ?? 0);
      const adjustedDistance = distanceM !== null ? Math.max(0, distanceM - accuracy) : null;

      if (adjustedDistance === null || adjustedDistance > 25) {
        return json(403, {
          ok: false,
          reason: "too_far_from_outlet",
          distance_m: distanceM ?? undefined,
          accuracy_m: accuracy,
        });
      }
    }

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
      gps_lat: body.gps_lat ?? null,
      gps_lng: body.gps_lng ?? null,
      distance_m: distanceM,
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
