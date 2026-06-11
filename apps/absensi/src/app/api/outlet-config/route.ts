import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { outlet_id, jam_masuk, jam_keluar, toleransi_menit, is_active } = body;
    
    if (!outlet_id) {
      return NextResponse.json({ error: "Missing outlet_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Using service role key to bypass RLS for SPV configuration
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { error: errConfig } = await supabaseAdmin
      .from("outlet_attendance_config")
      .update({ jam_masuk, jam_keluar, toleransi_menit })
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
