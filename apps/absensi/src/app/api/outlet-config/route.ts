import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { applyTo, outletIds, jam_masuk, jam_keluar, toleransi_menit, is_active, absen_window_mode } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const configUpdate: Record<string, unknown> = {};
    if (jam_masuk !== undefined) configUpdate.jam_masuk = jam_masuk;
    if (jam_keluar !== undefined) configUpdate.jam_keluar = jam_keluar;
    if (toleransi_menit !== undefined) configUpdate.toleransi_menit = toleransi_menit;
    if (absen_window_mode !== undefined) configUpdate.absen_window_mode = absen_window_mode;

    if (applyTo === "all") {
      // 1. Upsert Global Settings
      const globalValue = { jam_masuk, jam_keluar, toleransi_menit, absen_window_mode };
      const { error: errGlobal } = await supabaseAdmin
        .from("global_settings")
        .upsert({ key: "global_attendance_config", value: globalValue });
      
      if (errGlobal) return NextResponse.json({ error: errGlobal.message }, { status: 500 });

      // 2. Bulk update all outlets is_active
      if (is_active !== undefined) {
         const { error: errOutlet } = await supabaseAdmin
           .from("outlets")
           .update({ is_active })
           .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows
         if (errOutlet) return NextResponse.json({ error: errOutlet.message }, { status: 500 });
      }
    } else if (applyTo === "specific" && Array.isArray(outletIds)) {
      for (const id of outletIds) {
        // We use upsert so it creates a row if it doesn't exist
        const { error: errConfig } = await supabaseAdmin
          .from("outlet_attendance_config")
          .upsert({ outlet_id: id, ...configUpdate });
        if (errConfig) return NextResponse.json({ error: errConfig.message }, { status: 500 });

        if (is_active !== undefined) {
          const { error: errOutlet } = await supabaseAdmin
            .from("outlets")
            .update({ is_active })
            .eq("id", id);
          if (errOutlet) return NextResponse.json({ error: errOutlet.message }, { status: 500 });
        }
      }
    } else {
       // Fallback to legacy single outlet update just in case
       const outlet_id = body.outlet_id;
       if (outlet_id) {
         const { error: errConfig } = await supabaseAdmin
           .from("outlet_attendance_config")
           .update(configUpdate)
           .eq("outlet_id", outlet_id);
         if (errConfig) return NextResponse.json({ error: errConfig.message }, { status: 500 });

         if (is_active !== undefined) {
           const { error: errOutlet } = await supabaseAdmin
             .from("outlets")
             .update({ is_active })
             .eq("id", outlet_id);
           if (errOutlet) return NextResponse.json({ error: errOutlet.message }, { status: 500 });
         }
       }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const outlet_id = searchParams.get("outlet_id");
    
    if (!outlet_id) return NextResponse.json({ error: "outlet_id is required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabaseAdmin
      .from("outlet_attendance_config")
      .delete()
      .eq("outlet_id", outlet_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
