import { NextResponse } from "next/server";
import { deleteGlobalSubmission } from "@/lib/globalCalibrationStore";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { submission_id } = body;

    deleteGlobalSubmission(submission_id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
