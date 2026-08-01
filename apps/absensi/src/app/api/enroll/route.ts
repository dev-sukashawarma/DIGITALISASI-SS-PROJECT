import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";

const SPV_ROLES = ["spv", "leader", "regional_manager", "area_manager", "admin", "admin_hr", "owner", "kitchen"];

export async function POST(req: NextRequest) {
  try {
    // 1. Ambil JWT dari Authorization header yang dikirim client
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
    }

    // 2. Verifikasi token & dapatkan user via service role
    const admin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
    }

    const { data: requester, error: reqErr } = await admin
      .from("outlet_staff")
      .select("id, role, outlet_id, status")
      .eq("id", user.id)
      .single();

    if (reqErr || !requester) {
      return NextResponse.json({ ok: false, reason: "requester_not_found" }, { status: 403 });
    }
    if (requester.status !== "active") {
      return NextResponse.json({ ok: false, reason: "requester_inactive" }, { status: 403 });
    }
    if (!SPV_ROLES.includes(requester.role)) {
      return NextResponse.json({ ok: false, reason: "forbidden_role", role: requester.role }, { status: 403 });
    }

    // 3. Parse body
    const body = await req.json();
    const { targetStaffId, descriptor, refPhotoPath, consentAt, isReEnroll, reEnrollReason } = body;

    if (!targetStaffId || !descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
      return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
    }

    // 4. Pastikan target staff ada (bisa dari outlet manapun).
    // SPV/Leader adalah global role — mereka bisa switch outlet via OutletSwitcher
    // sehingga outlet_id mereka di DB bisa berbeda dengan outlet yang di-enroll.
    // Validasi akses sudah cukup di level role (step 3 di atas).
    const { data: target, error: targetErr } = await admin
      .from("outlet_staff")
      .select("id")
      .eq("id", targetStaffId)
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ ok: false, reason: "target_not_found" }, { status: 404 });
    }

    // 5. Update dengan service_role — bypass RLS sepenuhnya
    const updatePayload: Record<string, unknown> = {
      face_descriptor: descriptor,
      ref_photo_url: refPhotoPath ?? null,
      consent_at: consentAt ?? new Date().toISOString(),
      consent_by: requester.id,
      enrolled_at: new Date().toISOString(),
    };

    if (isReEnroll) {
      updatePayload.re_enrolled_at = new Date().toISOString();
      updatePayload.re_enrolled_by = requester.id;
      updatePayload.re_enroll_reason = reEnrollReason?.trim() || null;
    }

    const { data: updated, error: updateErr } = await admin
      .from("outlet_staff")
      .update(updatePayload)
      .eq("id", targetStaffId)
      .select("id");

    if (updateErr) {
      return NextResponse.json({ ok: false, reason: "update_failed", detail: updateErr.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ ok: false, reason: "no_rows_updated" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error", detail: err.message }, { status: 500 });
  }
}
