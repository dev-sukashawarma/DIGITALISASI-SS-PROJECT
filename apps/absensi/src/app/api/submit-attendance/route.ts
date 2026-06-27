import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { haversineMeters, GEOFENCE_RADIUS_M } from "@/lib/gps";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: target } = await admin
      .from("outlet_staff")
      .select("outlet_id, face_descriptor")
      .eq("id", body.outlet_staff_id).single();
      
    if (!target) return NextResponse.json({ ok: false, reason: "staff_not_found" }, { status: 404 });
    if (target.outlet_id !== body.outlet_id) return NextResponse.json({ ok: false, reason: "cross_outlet" }, { status: 403 });
    if (!target.face_descriptor) return NextResponse.json({ ok: false, reason: "not_enrolled" }, { status: 422 });

    // Validasi radius GPS server-side = GEOFENCE_RADIUS_M (konsisten dgn client) + toleransi akurasi
    const { data: outlet } = await admin
      .from("outlets")
      .select("lat, lng")
      .eq("id", body.outlet_id)
      .single();
    if (!outlet) return NextResponse.json({ ok: false, reason: "outlet_not_found" }, { status: 404 });

    let distanceM: number | null = null;
    // Hanya validasi GPS jika koordinat outlet terdaftar (tidak null)
    if (outlet.lat !== null && outlet.lng !== null) {
      if (body.gps_lat !== undefined && body.gps_lat !== null && body.gps_lng !== undefined && body.gps_lng !== null) {
        const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };
        const userCoords = { lat: Number(body.gps_lat), lng: Number(body.gps_lng) };
        distanceM = haversineMeters(outletCoords, userCoords);
      }

      // Toleransi akurasi dinamis: Jarak - Akurasi GPS <= GEOFENCE_RADIUS_M
      const accuracy = Number(body.gps_accuracy ?? 0);
      const adjustedDistance = distanceM !== null ? Math.max(0, distanceM - accuracy) : null;

      if (adjustedDistance === null || adjustedDistance > GEOFENCE_RADIUS_M) {
        return NextResponse.json({
          ok: false,
          reason: "too_far_from_outlet",
          distance_m: distanceM ?? undefined,
          accuracy_m: accuracy,
        }, { status: 403 });
      }
    }

    if (body.selfie_path && !body.selfie_path.startsWith(`${body.outlet_id}/`)) {
      return NextResponse.json({ ok: false, reason: "selfie_path_mismatch" }, { status: 403 });
    }

    const { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,jam_keluar,toleransi_menit,absen_window_mode")
      .eq("outlet_id", body.outlet_id).single();

    if (!cfg) return NextResponse.json({ ok: false, reason: "config_missing" }, { status: 500 });

    const tsServer = new Date().toISOString();
    const basis = body.from_queue ? body.ts_client : tsServer;

    // Status Logic
    const local = new Date(new Date(basis).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

    // ── Time window validation (hanya mode 'auto') ─────────────────────────
    // Hitung total menit dari jam config, lalu bandingkan dengan waktu lokal.
    function toTotalMinutes(timeStr: string) {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    }
    const nowMinutes = local.getHours() * 60 + local.getMinutes();

    if ((cfg.absen_window_mode ?? "auto") === "auto") {
      if (body.type === "in") {
        const windowOpen = toTotalMinutes(cfg.jam_masuk) - 60;
        if (nowMinutes < windowOpen) {
          return NextResponse.json({ ok: false, reason: "too_early_in" }, { status: 200 });
        }
      }
      if (body.type === "out") {
        const windowOpen = toTotalMinutes(cfg.jam_keluar || "17:00") - 30;
        if (nowMinutes < windowOpen) {
          return NextResponse.json({ ok: false, reason: "too_early_out" }, { status: 200 });
        }
      }
    }
    // ───────────────────────────────────────────────────────────────────────
    let status = "tepat";
    
    if (body.type === "out") {
      const [hOut, mOut] = (cfg.jam_keluar || "17:00").split(":").map(Number);
      const deadlineOut = new Date(local);
      deadlineOut.setHours(hOut, mOut, 0, 0);
      
      const diffMins = Math.floor((local.getTime() - deadlineOut.getTime()) / 60000);
      if (diffMins < 0) {
        status = "lebih_awal";
      } else if (diffMins >= 1) {
        status = "pulang_telat";
      } else {
        status = "tepat";
      }
    } else {
      const [h, m] = cfg.jam_masuk.split(":").map(Number);
      
      const jamMasukDeadline = new Date(local);
      jamMasukDeadline.setHours(h, m, 0, 0);

      const toleransiDeadline = new Date(local);
      toleransiDeadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

      if (local.getTime() <= jamMasukDeadline.getTime()) {
        status = "tepat";
      } else if (local.getTime() <= toleransiDeadline.getTime()) {
        status = "telat";
      } else {
        status = "alpha";
      }
    }

    // Tolak absen masuk telat SEBELUM menyimpan — agar tidak membuat record
    // "alpha" yang mengunci kiosk seharian (decideAction memblokir bila ada
    // record in berstatus alpha). Status alpha tetap dihitung virtual di rekap.
    if (status === "alpha" && body.type === "in") {
      return NextResponse.json({ ok: false, reason: "terlambat_alpha", ts_server: tsServer, attendance_id: body.id }, { status: 200 });
    }

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

    if (error) return NextResponse.json({ ok: false, reason: "insert_failed", detail: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status, ts_server: tsServer, attendance_id: body.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
