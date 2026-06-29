import { NextResponse } from "next/server";
import { getToken, updateToken } from "@/lib/calibrationStore";

export async function POST(request: Request) {
  try {
    const { token, lat, lng, accuracy } = await request.json();
    
    if (!token || lat === undefined || lng === undefined) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const tokenData = getToken(token);
    if (!tokenData) {
      return NextResponse.json({ ok: false, error: "Token tidak valid atau sudah kadaluarsa" }, { status: 400 });
    }

    if (tokenData.status !== 'pending') {
      return NextResponse.json({ ok: false, error: "Link ini sudah digunakan sebelumnya" }, { status: 400 });
    }

    // Server-side Reverse Geocoding via ArcGIS
    let address = "Alamat tidak ditemukan";
    try {
      const geoUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=${lng},${lat}`;
      const geoRes = await fetch(geoUrl);
      const geoData = await geoRes.json();
      if (geoData?.address?.Match_addr) {
        address = geoData.address.Match_addr;
      }
    } catch (e) {
      console.error("Reverse geocoding failed", e);
    }

    updateToken(token, {
      status: 'submitted',
      lat,
      lng,
      accuracy,
      address
    });

    return NextResponse.json({ ok: true, message: "Lokasi berhasil direkam" });
  } catch (err: any) {
    console.error("Error submit calibration", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
