import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ROLES = new Set(["spv", "admin", "owner", "leader"]);

export async function POST(req: Request) {
  try {
    // 1. Verifikasi caller dari bearer token (bukan anon).
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    // 2. Cek role SPV/admin/owner.
    const { data: staff } = await admin
      .from("outlet_staff")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (!staff || !ALLOWED_ROLES.has(staff.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // 3. Validasi payload.
    const body = await req.json();
    const { outlet_id, lat, lng } = body;
    if (!outlet_id || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, error: "missing_or_invalid_params" }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ ok: false, error: "coords_out_of_range" }, { status: 400 });
    }

    // 4. Tulis koordinat (bypass RLS via service role).
    const { error } = await admin.from("outlets").update({ lat, lng }).eq("id", outlet_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "internal_error" }, { status: 500 });
  }
}
