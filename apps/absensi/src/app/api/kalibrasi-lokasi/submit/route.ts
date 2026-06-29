import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { saveGlobalSubmission } from "@/lib/globalCalibrationStore";
import { randomUUID } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, accuracy } = body;

    if (!lat || !lng) {
      return NextResponse.json({ ok: false, error: "Koordinat tidak valid" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Fetch all active outlets
    const { data: outlets, error } = await supabase
      .from("outlets")
      .select("id, name, lat, lng")
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);

    if (error || !outlets || outlets.length === 0) {
      return NextResponse.json({ ok: false, error: "Gagal mengambil data outlet" }, { status: 500 });
    }

    // Find the nearest outlet
    let nearestOutlet = outlets[0];
    let minDistance = calculateDistance(lat, lng, outlets[0].lat, outlets[0].lng);

    for (let i = 1; i < outlets.length; i++) {
      const dist = calculateDistance(lat, lng, outlets[i].lat, outlets[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestOutlet = outlets[i];
      }
    }

    // Reverse geocode to get the address
    const params = new URLSearchParams({
      location: `${lng},${lat}`,
      f: "json",
    });

    let address = "Alamat tidak ditemukan";
    try {
      const geoRes = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?${params.toString()}`);
      const geoJson = await geoRes.json();
      if (geoJson.address && geoJson.address.Match_addr) {
        address = geoJson.address.Match_addr;
      }
    } catch (e) {
      console.error("Geocode error", e);
    }

    const submissionId = randomUUID();
    saveGlobalSubmission({
      id: submissionId,
      matched_outlet_id: nearestOutlet.id,
      matched_outlet_name: nearestOutlet.name,
      distance_meters: Math.round(minDistance),
      lat,
      lng,
      accuracy,
      address,
      submitted_at: new Date().toISOString()
    });

    return NextResponse.json({ ok: true, matched: nearestOutlet.name });
  } catch (error: any) {
    console.error("Global calibration submit error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
