import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { outlet_staff_id, action } = body;
    
    if (!outlet_staff_id) {
      return NextResponse.json({ error: "Missing outlet_staff_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Using service role key to bypass RLS for debugging purposes
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    if (action === "reset_log") {
      const { error } = await supabaseAdmin
        .from("attendance")
        .delete()
        .eq("outlet_staff_id", outlet_staff_id);
        
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === "unenroll") {
      const { error } = await supabaseAdmin
        .from("outlet_staff")
        .update({ face_descriptor: null })
        .eq("id", outlet_staff_id);
        
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
