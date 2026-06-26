import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { outlet_id, jam_masuk, jam_keluar, toleransi_menit, is_active, absen_window_mode } = body;

    if (!outlet_id) {
      return NextResponse.json({ error: "Missing outlet_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const configUpdate: Record<string, unknown> = { jam_masuk, jam_keluar, toleransi_menit };
    if (absen_window_mode !== undefined) configUpdate.absen_window_mode = absen_window_mode;

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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
