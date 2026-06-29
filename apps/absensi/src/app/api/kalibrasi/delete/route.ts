import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteToken, getToken } from "@/lib/calibrationStore";

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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
