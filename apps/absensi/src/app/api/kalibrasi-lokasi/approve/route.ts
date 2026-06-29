import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGlobalSubmission, deleteGlobalSubmission } from "@/lib/globalCalibrationStore";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { submission_id } = body;

    const submission = getGlobalSubmission(submission_id);
    if (!submission) {
      return NextResponse.json({ ok: false, error: "Data kalibrasi tidak ditemukan atau sudah kadaluarsa." }, { status: 404 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify token
    const tokenStr = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(tokenStr);
    
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // Update the database for the MATCHED outlet
    const { error: updateError } = await supabase
      .from('outlets')
      .update({ lat: submission.lat, lng: submission.lng, address: submission.address })
      .eq('id', submission.matched_outlet_id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    // Delete from memory once saved
    deleteGlobalSubmission(submission_id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Global calibration approve error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
