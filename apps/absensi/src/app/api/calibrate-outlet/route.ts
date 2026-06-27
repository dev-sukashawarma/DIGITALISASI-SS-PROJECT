import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { outlet_id, lat, lng } = body;

    if (!outlet_id || lat === undefined || lng === undefined) {
      return NextResponse.json({ ok: false, error: "Missing parameters" }, { status: 400 });
    }

    const { error } = await admin
      .from("outlets")
      .update({ lat, lng })
      .eq("id", outlet_id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
