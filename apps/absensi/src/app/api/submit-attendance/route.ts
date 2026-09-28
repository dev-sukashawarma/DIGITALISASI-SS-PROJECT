import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { 
  haversineMeters, 
  GEOFENCE_RADIUS_M, 
  MAX_GPS_ACCURACY_M, 
  detectFakeGpsSignals, 
  calculateSpeedKmH, 
  MAX_REASONABLE_SPEED_KMH 
} from "@/lib/gps";
import { isShiftKe } from "@/lib/attendance/shift";

// Status HTTP untuk alasan penolakan RPC submit_attendance. Alasan lain
// (shift_required, too_early_out, shift_not_closed, ...) tetap 200 seperti dulu.
const STATUS_ALASAN: Record<string, number> = {
  invalid_payload: 400,
  staff_not_found: 404,
  outlet_not_found: 404,
  staff_inactive: 403,
  cross_outlet: 403,
  outlet_inactive: 403,
  config_missing: 500,
};

/**
 * Absen web. Route ini hanya memegang lapisan anti-kecurangan yang butuh data klien
 * (enrollment wajah, deteksi fake GPS & teleportasi + catatan alert-nya, jarak dengan
 * alasan rinci, kecocokan path selfie). Semua aturan absen lainnya ada di RPC.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (!body.outlet_staff_id || typeof body.match_distance !== "number") {
      return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
    }

    const { data: target, error: targetError } = await admin
      .from("outlet_staff")
      .select("face_descriptor, face_descriptor_mobile, status")
      .eq("id", body.outlet_staff_id)
      .maybeSingle();

    if (targetError || !target) {
      return NextResponse.json({ ok: false, reason: "staff_not_found" }, { status: 404 });
    }
    if (target.status !== "active") {
      return NextResponse.json({ ok: false, reason: "staff_inactive" }, { status: 403 });
    }

    const hasEnrollment = Boolean(
      (target.face_descriptor && Array.isArray(target.face_descriptor) && target.face_descriptor.length > 0) ||
      (target.face_descriptor_mobile && Array.isArray(target.face_descriptor_mobile) && target.face_descriptor_mobile.length > 0)
    );
    if (!hasEnrollment) return NextResponse.json({ ok: false, reason: "not_enrolled" }, { status: 422 });

    // Radius mengikuti pengaturan pusat. Row outlet tetap didahulukan agar
    // konfigurasi hasil sinkronisasi/exception tetap kompatibel dengan data lama.
    const { data: radiusConfig } = await admin
      .from("outlet_attendance_config")
      .select("radius_m")
      .eq("outlet_id", body.outlet_id)
      .maybeSingle();
    let configuredRadiusM = Number(radiusConfig?.radius_m ?? 0);
    if (!Number.isFinite(configuredRadiusM) || configuredRadiusM <= 0) {
      const { data: globalRadiusRow } = await admin
        .from("global_settings")
        .select("value")
        .eq("key", "global_attendance_config")
        .maybeSingle();
      const globalRadiusValue = globalRadiusRow?.value as { radius_m?: number } | null;
      configuredRadiusM = Number(globalRadiusValue?.radius_m ?? GEOFENCE_RADIUS_M);
    }
    if (!Number.isFinite(configuredRadiusM) || configuredRadiusM <= 0) {
      configuredRadiusM = GEOFENCE_RADIUS_M;
    }

    // Validasi radius GPS server-side + toleransi akurasi.
    const { data: outlet } = await admin
      .from("outlets")
      .select("lat, lng")
      .eq("id", body.outlet_id)
      .single();
    if (!outlet) return NextResponse.json({ ok: false, reason: "outlet_not_found" }, { status: 404 });

    let distanceM: number | null = null;
    // Hanya validasi GPS jika koordinat outlet terdaftar (tidak null)
    if (outlet.lat !== null && outlet.lng !== null) {
      const reportedAccuracy = Number(body.gps_accuracy ?? 0);
      
      // Layer 1: Deteksi Meta Sinyal Fake GPS / Mock Location Provider
      const fakeGpsCheck = detectFakeGpsSignals({
        accuracy: reportedAccuracy,
        isMock: body.is_mock
      });

      if (fakeGpsCheck.isFakeGps) {
        // Catat Alert Keamanan untuk SPV di database
        await admin.from("attendance").upsert({
          id: body.id || crypto.randomUUID(),
          outlet_staff_id: body.outlet_staff_id,
          outlet_id: body.outlet_id,
          type: body.type || "in",
          ts_server: new Date().toISOString(),
          ts_client: body.ts_client || new Date().toISOString(),
          gps_lat: body.gps_lat ?? null,
          gps_lng: body.gps_lng ?? null,
          distance_m: null,
          match_distance: body.match_distance || 0,
          selfie_url: body.selfie_path || null,
          status: "fake_gps_blocked",
          telat_menit: null,
          is_manual_button: body.is_manual_button || false
        }, { onConflict: "id", ignoreDuplicates: true });

        return NextResponse.json({
          ok: false,
          reason: "fake_gps_detected",
          message: "Lokasi tidak dapat diverifikasi. Harap matikan penyedia lokasi pihak ketiga (Mock Location) dan aktifkan GPS Akurat.",
          accuracy_m: reportedAccuracy,
        }, { status: 403 });
      }

      // Tolak bila akurasi GPS sangat buruk — radius 30 m jadi tak bermakna
      if (reportedAccuracy > MAX_GPS_ACCURACY_M) {
        return NextResponse.json({
          ok: false,
          reason: "gps_accuracy_low",
          accuracy_m: reportedAccuracy,
        }, { status: 403 });
      }

      if (body.gps_lat !== undefined && body.gps_lat !== null && body.gps_lng !== undefined && body.gps_lng !== null) {
        const outletCoords = { lat: Number(outlet.lat), lng: Number(outlet.lng) };
        const userCoords = { lat: Number(body.gps_lat), lng: Number(body.gps_lng) };
        distanceM = haversineMeters(outletCoords, userCoords);

        // Layer 2: Deteksi Teleportasi / Perpindahan Instan Tidak Wajar (Speed > 160 km/h)
        const { data: lastAttendance } = await admin
          .from("attendance")
          .select("gps_lat, gps_lng, ts_server")
          .eq("outlet_staff_id", body.outlet_staff_id)
          .not("gps_lat", "is", null)
          .order("ts_server", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastAttendance && lastAttendance.gps_lat && lastAttendance.gps_lng && lastAttendance.ts_server) {
          const prevCoords = { lat: Number(lastAttendance.gps_lat), lng: Number(lastAttendance.gps_lng) };
          const prevTimeMs = new Date(lastAttendance.ts_server).getTime();
          const currTimeMs = new Date().getTime();
          
          // Hanya hitung jika riwayat absen terakhir terjadi kurang dari 2 jam lalu
          const timeDiffMin = (currTimeMs - prevTimeMs) / 60000;
          if (timeDiffMin > 0 && timeDiffMin <= 120) {
            const speedKmh = calculateSpeedKmH(prevCoords, prevTimeMs, userCoords, currTimeMs);
            if (speedKmh > MAX_REASONABLE_SPEED_KMH) {
              // Catat Alert Teleportasi untuk SPV di database
              await admin.from("attendance").upsert({
                id: body.id || crypto.randomUUID(),
                outlet_staff_id: body.outlet_staff_id,
                outlet_id: body.outlet_id,
                type: body.type || "in",
                ts_server: new Date().toISOString(),
                ts_client: body.ts_client || new Date().toISOString(),
                gps_lat: body.gps_lat ?? null,
                gps_lng: body.gps_lng ?? null,
                distance_m: distanceM,
                match_distance: body.match_distance || 0,
                selfie_url: body.selfie_path || null,
                status: "teleportation_blocked",
                telat_menit: null,
                is_manual_button: body.is_manual_button || false
              }, { onConflict: "id", ignoreDuplicates: true });

              return NextResponse.json({
                ok: false,
                reason: "teleportation_detected",
                message: "Perpindahan lokasi instan tidak wajar terdeteksi.",
                speed_kmh: Math.round(speedKmh)
              }, { status: 403 });
            }
          }
        }
      }

      // Toleransi akurasi dinamis: Jarak - Akurasi GPS <= radius pengaturan.
      const accuracy = Number(body.gps_accuracy ?? 0);
      const adjustedDistance = distanceM !== null ? Math.max(0, distanceM - accuracy) : null;

      if (adjustedDistance === null || adjustedDistance > configuredRadiusM) {
        return NextResponse.json({
          ok: false,
          reason: `too_far_from_outlet: Jarak ${Math.round(distanceM || 0)}m (Akurasi ${Math.round(accuracy)}m)`,
          distance_m: distanceM ?? undefined,
          accuracy_m: accuracy,
        }, { status: 403 });
      }
    }

    if (body.selfie_path && !body.selfie_path.startsWith(`${body.outlet_id}/`)) {
      return NextResponse.json({ ok: false, reason: "selfie_path_mismatch" }, { status: 403 });
    }

    // ── Aturan absen: satu sumber di server (RPC submit_attendance) ──────────
    // Izin outlet (outlet utama, penempatan HR, izin tambahan admin, izin semua
    // outlet), jadwal & shift 1..N (termasuk lewat tengah malam), gerbang shift
    // penutup, jendela absen, status, insert idempoten, dan pemindahan outlet utama
    // semuanya ditegakkan RPC yang sama dengan app native — satu round trip.
    const payload = {
      id: body.id,
      outlet_staff_id: body.outlet_staff_id,
      outlet_id: body.outlet_id,
      type: body.type,
      ts_client: body.ts_client,
      gps_lat: body.gps_lat ?? null,
      gps_lng: body.gps_lng ?? null,
      gps_accuracy: body.gps_accuracy ?? null,
      match_distance: body.match_distance,
      selfie_path: body.selfie_path ?? null,
      is_manual_button: body.is_manual_button || false,
      // Nomor tak sah dibuang di sini agar tidak jadi galat cast di RPC; bila
      // outlet memakai pilihan shift, RPC menjawab shift_required.
      shift_ke: isShiftKe(body.shift_ke) ? body.shift_ke : null,
      // Jalur normal adalah web. Namun antrean offline Super App menggunakan
      // endpoint ini saat kembali online dan membawa penanda asalnya.
      source: body.source === "native" ? "native" : "web",
      sumber_offline: !!body.from_queue,
    };

    const { data: hasil, error: rpcError } = await admin.rpc("submit_attendance", { payload });
    if (rpcError) {
      return NextResponse.json({ ok: false, reason: "insert_failed", detail: rpcError.message }, { status: 500 });
    }

    const r = (hasil ?? {}) as { ok?: boolean; reason?: string; status?: string; ts_server?: string; attendance_id?: string };
    if (r.ok) {
      return NextResponse.json(
        { ok: true, status: r.status, ts_server: r.ts_server, attendance_id: r.attendance_id ?? body.id },
        { status: 200 },
      );
    }
    const reason = r.reason ?? "internal_error";
    return NextResponse.json({ ok: false, reason }, { status: STATUS_ALASAN[reason] ?? 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
