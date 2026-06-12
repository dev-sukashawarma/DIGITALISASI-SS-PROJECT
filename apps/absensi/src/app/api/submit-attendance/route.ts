import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    if (body.selfie_base64) {
      const base64Str = body.selfie_base64.split(",")[1];
      const buffer = Buffer.from(base64Str, "base64");
      const path = `${body.outlet_id}/${body.id}.jpg`;
      const { error: uploadErr } = await admin.storage.from("selfies").upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (uploadErr) console.error("Selfie upload err server:", uploadErr);
      body.selfie_path = path;
    } else if (body.selfie_path && !body.selfie_path.startsWith(`${body.outlet_id}/`)) {
      return NextResponse.json({ ok: false, reason: "selfie_path_mismatch" }, { status: 403 });
    }

    const { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,jam_keluar,toleransi_menit")
      .eq("outlet_id", body.outlet_id).single();
      
    if (!cfg) return NextResponse.json({ ok: false, reason: "config_missing" }, { status: 500 });

    const tsServer = new Date().toISOString();
    const basis = body.from_queue ? body.ts_client : tsServer;
    
    // Status Logic
    const local = new Date(new Date(basis).toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    let status = "tepat";
    
    if (body.type === "out") {
      const [hOut, mOut] = (cfg.jam_keluar || "17:00").split(":").map(Number);
      const deadlineOut = new Date(local);
      deadlineOut.setHours(hOut, mOut, 0, 0);
      status = local.getTime() < deadlineOut.getTime() ? "telat" : "tepat";
    } else {
      const [h, m] = cfg.jam_masuk.split(":").map(Number);
      const deadline = new Date(local);
      deadline.setHours(h, m + cfg.toleransi_menit, 0, 0);
      status = local.getTime() <= deadline.getTime() ? "tepat" : "alpha";
    }

    // Status alpha tetap dihitung dan kini diizinkan masuk ke database
    // karena bug penguncian kiosk akibat absen alpha sudah diperbaiki di sisi database.

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

    if (error) return NextResponse.json({ ok: false, reason: "insert_failed", detail: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status, ts_server: tsServer, attendance_id: body.id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
