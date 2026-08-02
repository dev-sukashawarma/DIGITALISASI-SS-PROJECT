import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const list: { id: string; name: string; lat: number | null; lng: number | null }[] = [];

    // 1. Fetch assigned outlets from staff_outlets table
    const { data: soData, error: soErr } = await admin
      .from("staff_outlets")
      .select("outlet_id, outlets!staff_outlets_outlet_id_fkey(id, name, lat, lng)")
      .eq("staff_id", staffId);

    if (soErr) {
      console.warn("PostgREST embed query warning, falling back to manual join:", soErr.message);
    }

    if (soData && soData.length > 0) {
      soData.forEach((row: any) => {
        const item = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets;
        if (item && item.id && !list.some((x) => x.id === item.id)) {
          list.push({
            id: item.id,
            name: item.name,
            lat: item.lat !== null ? Number(item.lat) : null,
            lng: item.lng !== null ? Number(item.lng) : null,
          });
        }
      });
    }

    // Fallback: If join embedding returned no items or error, fetch outlet_ids and query outlets manually
    if (list.length === 0) {
      const { data: rawSo } = await admin
        .from("staff_outlets")
        .select("outlet_id")
        .eq("staff_id", staffId);

      const assignedIds = (rawSo || []).map((r: any) => r.outlet_id).filter(Boolean);
      if (assignedIds.length > 0) {
        const { data: outletRows } = await admin
          .from("outlets")
          .select("id, name, lat, lng")
          .in("id", assignedIds);

        (outletRows || []).forEach((item: any) => {
          if (!list.some((x) => x.id === item.id)) {
            list.push({
              id: item.id,
              name: item.name,
              lat: item.lat !== null ? Number(item.lat) : null,
              lng: item.lng !== null ? Number(item.lng) : null,
            });
          }
        });
      }
    }

    // 3. For SPV, Owner, Admin, Admin HR, and Korlap roles: if list has <= 1 outlet, load all active outlets so SPV can choose any outlet!
    const { data: staffRoleData } = await admin
      .from("outlet_staff")
      .select("role")
      .eq("id", staffId)
      .maybeSingle();

    if (["spv", "owner", "admin", "admin_hr", "korlap", "regional_manager", "area_manager"].includes(staffRoleData?.role || "")) {
      if (list.length <= 1) {
        const { data: allOutlets } = await admin
          .from("outlets")
          .select("id, name, lat, lng")
          .eq("is_active", true)
          .order("name");

        if (allOutlets && allOutlets.length > 0) {
          allOutlets.forEach((item: any) => {
            if (!list.some((x) => x.id === item.id)) {
              list.push({
                id: item.id,
                name: item.name,
                lat: item.lat !== null ? Number(item.lat) : null,
                lng: item.lng !== null ? Number(item.lng) : null,
              });
            }
          });
        }
      }
    }

    return NextResponse.json({ ok: true, outlets: list }, { status: 200 });
  } catch (err: any) {
    console.error("API /api/staff-outlets error:", err);
    return NextResponse.json({ ok: false, reason: "internal_error" }, { status: 500 });
  }
}
