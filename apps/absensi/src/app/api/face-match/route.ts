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
      .select("id, name, face_descriptor")
      .or(`outlet_id.eq.${outletId},role.in.(spv,admin,owner,admin_hr,leader,korlap,regional_manager)`)
      .not("face_descriptor", "is", null);

    if (lockToStaffId) {
      query = query.eq("id", lockToStaffId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, reason: "db_error", detail: error.message }, { status: 500 });
    }

    const candidates: Candidate[] = (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      descriptor: s.face_descriptor,
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
      descriptor: matchedCandidate?.descriptor
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ ok: false, reason: "internal_error", detail: err.message }, { status: 500 });
  }
}
