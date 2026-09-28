import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { identifyStaff, type Candidate } from "@/lib/face/identify";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    // Gunakan service role untuk read seluruh face_descriptor (1:N search)
    const admin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse body
    const body = await req.json();
    const { descriptor, outletId, lockToStaffId } = body;

    if (!descriptor || !Array.isArray(descriptor) || !outletId) {
      return NextResponse.json({ ok: false, reason: "invalid_payload" }, { status: 400 });
    }

    // Ambil kandidat
    let query = admin
      .from("outlet_staff")
      .select("id, name, face_descriptor, role")
      .not("face_descriptor", "is", null);

    if (lockToStaffId) {
      // MODE 1:1 (panel absen pribadi): verifikasi akun yang login saja. Outlet tidak
      // menyaring kandidat — outletId juga kiriman klien, jadi bukan batas keamanan —
      // dan izin absen di outlet ini (termasuk izin tambahan dari admin) ditegakkan
      // RPC submit_attendance. Tanpa ini crew berizin tambahan tak pernah dikenali
      // di outlet selain outlet utamanya.
      query = query.eq("id", lockToStaffId);
    } else {
      // MODE 1:N (kiosk bersama): staff outlet ini, penempatan (staff_outlets), crew
      // berizin tambahan / semua outlet, dan peran pengawas. Ketiga daftar dibaca paralel.
      const [penempatanRes, aksesRes, semuaRes] = await Promise.all([
        admin.from("staff_outlets").select("staff_id").eq("outlet_id", outletId),
        admin.from("attendance_outlet_access").select("staff_id").eq("outlet_id", outletId),
        admin.from("attendance_any_outlet_staff").select("staff_id"),
      ]);
      const allowedStaffIds = Array.from(new Set(
        [penempatanRes.data, aksesRes.data, semuaRes.data]
          .flatMap((rows) => (rows || []).map((row: any) => row.staff_id as string))
      ));
      let orQuery = `outlet_id.eq.${outletId},role.in.(spv,admin,owner,admin_hr,leader,korlap,regional_manager,area_manager)`;
      if (allowedStaffIds.length > 0) {
        orQuery += `,id.in.(${allowedStaffIds.join(',')})`;
      }
      query = query.or(orQuery);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, reason: "db_error", detail: error.message }, { status: 500 });
    }

    const candidates: (Candidate & { role?: string })[] = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      descriptor: s.face_descriptor,
      role: s.role,
    }));

    if (candidates.length === 0) {
      return NextResponse.json({ ok: false, reason: "no_candidates" }, { status: 404 });
    }

    // Lakukan pencocokan di sisi server (jauh lebih ringan dari AI vision)
    const found = identifyStaff(descriptor, candidates);

    if (found.id === "unknown") {
      return NextResponse.json({ 
        ok: false, 
        reason: "unknown_face", 
        bestSimilarity: found.bestSimilarity 
      }, { status: 200 });
    }

    // Return kandidat yang cocok beserta deskriptor aslinya agar di-cache di client untuk fase liveness
    const matchedCandidate = candidates.find(c => c.id === found.id);

    return NextResponse.json({
      ok: true,
      staffId: found.id,
      name: found.name,
      similarity: found.similarity,
      role: matchedCandidate?.role,
      descriptor: matchedCandidate?.descriptor
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error", detail: err.message }, { status: 500 });
  }
}
