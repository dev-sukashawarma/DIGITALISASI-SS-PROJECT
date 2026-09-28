import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OutletAbsen = { id: string; name: string; lat: number | null; lng: number | null; type: string | null };

/**
 * Outlet tempat staff boleh absen, untuk picker outlet panel absen.
 * Aturannya milik RPC `attendance_outlets` — sama persis dengan cek izin di
 * submit_attendance (outlet utama, penempatan HR, izin tambahan admin, izin semua
 * outlet, peran pengawas) — jadi daftar ini tak pernah menawarkan outlet yang
 * kemudian ditolak saat absen. Satu round trip; outlet utama di urutan pertama.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staff_id");

    if (!staffId) {
      return NextResponse.json({ ok: false, reason: "missing_staff_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.rpc("attendance_outlets", { p_staff_id: staffId });
    if (error) {
      console.error("API /api/staff-outlets rpc error:", error.message);
      return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
    }

    const list: OutletAbsen[] = ((data ?? []) as any[]).map((o) => ({
      id: o.id,
      name: o.name,
      lat: o.lat !== null && o.lat !== undefined ? Number(o.lat) : null,
      lng: o.lng !== null && o.lng !== undefined ? Number(o.lng) : null,
      type: o.type ?? null,
    }));

    return NextResponse.json({ ok: true, outlets: list }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/staff-outlets error:", err);
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
