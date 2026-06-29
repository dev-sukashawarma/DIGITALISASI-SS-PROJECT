import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { deleteToken, getToken } from "@/lib/calibrationStore";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
    }

    // Hanya SPV/admin yang bisa menghapus, ini dicek via policy, 
    // tapi karena ini file JSON lokal, kita cukup auth user saja (yang sudah login ke dashboard)
    
    const t = getToken(token);
    if (!t) {
      return NextResponse.json({ ok: false, error: "Token tidak valid atau sudah kadaluarsa" }, { status: 400 });
    }

    deleteToken(token);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
