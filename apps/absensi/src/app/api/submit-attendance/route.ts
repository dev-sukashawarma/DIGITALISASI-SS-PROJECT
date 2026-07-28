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
      .select("outlet_id, face_descriptor, role, status")
      .eq("id", body.outlet_staff_id)
      .maybeSingle();

    if (targetError || !target) {
      return NextResponse.json({ ok: false, reason: "staff_not_found" }, { status: 404 });
    }
    if (target.status !== "active") {
      return NextResponse.json({ ok: false, reason: "staff_inactive" }, { status: 403 });
    }

    const isGlobalRole = ["spv", "owner", "admin", "admin_hr"].includes(target.role);
    if (!isGlobalRole && target.outlet_id !== body.outlet_id) {
      // Cek apakah outlet_id ini terdaftar untuk staff di tabel staff_outlets (misal: Leader multi-outlet)
      const { data: allowedAssigned } = await admin
        .from("staff_outlets")
        .select("outlet_id")
        .eq("staff_id", body.outlet_staff_id)
        .eq("outlet_id", body.outlet_id)
        .maybeSingle();

      if (!allowedAssigned) {
        return NextResponse.json({ ok: false, reason: "cross_outlet" }, { status: 403 });
      }
    }
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
          telat_menit: null
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
                telat_menit: null
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

      // Toleransi akurasi dinamis: Jarak - Akurasi GPS <= GEOFENCE_RADIUS_M
      const accuracy = Number(body.gps_accuracy ?? 0);
      const adjustedDistance = distanceM !== null ? Math.max(0, distanceM - accuracy) : null;

      if (adjustedDistance === null || adjustedDistance > GEOFENCE_RADIUS_M) {
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

    // Blokir absen pulang selama shift kasir (laci) outlet ini masih terbuka.
    // Shift adalah state milik OUTLET, bukan staf tertentu — berlaku untuk siapa
    // pun yang absen pulang di outlet ini. Tidak ada bypass.
    if (body.type === "out") {
      const { data: openShift } = await admin
        .from("shifts")
        .select("id")
        .eq("outlet_id", body.outlet_id)
        .eq("status", "open")
        .maybeSingle();
      if (openShift) {
        return NextResponse.json({ ok: false, reason: "shift_not_closed" }, { status: 200 });
      }
    }

    let { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,jam_keluar,toleransi_menit,absen_window_mode")
      .eq("outlet_id", body.outlet_id)
      .maybeSingle();

    if (!cfg) {
      const { data: globalRow } = await admin
        .from("global_settings")
        .select("value")
        .eq("key", "global_attendance_config")
        .maybeSingle();
      if (globalRow && globalRow.value) {
        let globalVal = globalRow.value;
        if (typeof globalVal === "string") {
          try {
            globalVal = JSON.parse(globalVal);
          } catch (e) {}
        }
        cfg = globalVal as any;
      }
    }

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
      // Absen masuk tidak ditutup sebelum buka outlet (diperbolehkan absen masuk kapan saja)
      if (body.type === "out") {
        const windowOpen = toTotalMinutes(cfg.jam_keluar || "17:00") - 30;
        if (nowMinutes < windowOpen) {
          return NextResponse.json({ ok: false, reason: "too_early_out" }, { status: 200 });
        }
      }
    }
    // ───────────────────────────────────────────────────────────────────────
    let status = "tepat";
    let telat_menit: number | null = null;
    
    if (body.type === "out") {
      const [hOut, mOut] = (cfg.jam_keluar || "17:00").split(":").map(Number);
      const deadlineOut = new Date(local);
      deadlineOut.setHours(hOut, mOut, 0, 0);
      
      const diffMins = Math.floor((local.getTime() - deadlineOut.getTime()) / 60000);
      if (diffMins < 0) {
        status = "lebih_awal";
        telat_menit = Math.abs(diffMins);
      } else if (diffMins >= 1) {
        status = "pulang_telat";
        telat_menit = diffMins;
      } else {
        status = "tepat";
      }
    } else {
      const [h, m] = cfg.jam_masuk.split(":").map(Number);
      
      const jamMasukDeadline = new Date(local);
      jamMasukDeadline.setHours(h, m, 0, 0);

      const toleransiDeadline = new Date(local);
      toleransiDeadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

      if (local.getTime() <= toleransiDeadline.getTime()) {
        status = "tepat";
      } else {
        status = "telat";
        telat_menit = Math.floor((local.getTime() - jamMasukDeadline.getTime()) / 60000);
      }
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
      telat_menit,
    }, { onConflict: "id", ignoreDuplicates: true });

    if (error) return NextResponse.json({ ok: false, reason: "insert_failed", detail: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status, ts_server: tsServer, attendance_id: body.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
