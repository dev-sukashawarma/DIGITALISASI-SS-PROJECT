import { NextResponse } from "next/server";
import { createToken } from "@/lib/calibrationStore";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { outlet_id } = await request.json();
    if (!outlet_id) return NextResponse.json({ ok: false, error: "Missing outlet_id" }, { status: 400 });

    // Cek auth header (SPV)
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // SPV diizinkan membuat token
    const token = createToken(outlet_id);
    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    console.error("Error generate calibration token", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
