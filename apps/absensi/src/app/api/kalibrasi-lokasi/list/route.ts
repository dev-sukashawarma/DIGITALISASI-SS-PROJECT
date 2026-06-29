import { NextResponse } from "next/server";
import { getAllGlobalSubmissions } from "@/lib/globalCalibrationStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = getAllGlobalSubmissions();
    return NextResponse.json({ ok: true, data: submissions });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
