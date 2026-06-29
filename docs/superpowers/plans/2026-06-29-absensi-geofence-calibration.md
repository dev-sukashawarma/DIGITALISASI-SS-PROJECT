# Absensi Geofence Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Beri SPV halaman peta untuk mengkalibrasi koordinat outlet secara akurat, perketat geofence ke 30 m, dan tolak absen saat akurasi GPS buruk — agar crew yang benar-benar di outlet terdeteksi dan yang jauh ditolak.

**Architecture:** Tambah halaman SPV-only `/dashboard/pengaturan-lokasi` berbasis Leaflet (OSM + satelit Esri, tanpa API key) yang menulis `outlets.lat/lng` lewat endpoint `/api/calibrate-outlet` yang kini diverifikasi role. Logika geofence (radius 30 m + ambang akurasi 75 m) tinggal di `src/lib/gps.ts` sebagai sumber tunggal, dikonsumsi client (`useClockKiosk`) dan server (`submit-attendance`).

**Tech Stack:** Next.js 16 (app router) · React 19 · TypeScript · TailwindCSS · Supabase JS · Leaflet · Vitest (runtime node)

## Global Constraints

- Geofence radius **global 30 m** — tidak ada kolom DB / radius per-outlet.
- Ambang akurasi GPS maksimum **75 m** — absen ditolak bila `accuracy > 75`.
- Outlet dengan `lat`/`lng` **NULL** (HQ, CIBUBUR) dikecualikan dari geofence — perilaku lama dipertahankan.
- Akses kalibrasi **SPV-only**: role ∈ `{ "spv", "admin", "owner" }`. Diverifikasi **server-side** di API, bukan hanya guard client.
- Peta wajib **tanpa API key / tanpa billing** (OSM + Esri World Imagery) — target hosting cPanel.
- Test runtime **node** (pola `src/lib/gps.test.ts`), matematika murni — tanpa DOM.
- Semua path absolut dari root repo `DIGITALISASI-SS-PROJECT/`. Perintah dijalankan dari `apps/absensi/` kecuali disebut lain.
- Auth token caller diambil via `createClient().auth.getSession()` → `data.session?.access_token` (klien browser Supabase `@suka/auth`).

## File Structure

| File | Tanggung jawab |
|---|---|
| `apps/absensi/src/lib/gps.ts` | Konstanta + helper murni: `GEOFENCE_RADIUS_M=30`, `MAX_GPS_ACCURACY_M=75`, `isGpsAccuracyAcceptable()`, `isWithinAdjustedRadius()` |
| `apps/absensi/src/lib/gps.test.ts` | Unit test konstanta & helper baru |
| `apps/absensi/src/app/api/calibrate-outlet/route.ts` | Endpoint update koordinat — verifikasi token + role SPV + validasi lat/lng |
| `apps/absensi/src/app/api/submit-attendance/route.ts` | Tolak `gps_accuracy>75` server-side |
| `apps/absensi/src/features/clock/useClockKiosk.ts` | Tolak `accuracy>75` tegas di `checkLocation`; map pesan `gps_accuracy_low` |
| `apps/absensi/src/components/OutletMapPicker.tsx` | Komponen Leaflet murni (dynamic, ssr:false) — pin draggable + lingkaran radius |
| `apps/absensi/src/app/dashboard/pengaturan-lokasi/page.tsx` | Halaman SPV-only: pilih outlet, peta, simpan |
| `apps/absensi/src/app/dashboard/layout.tsx` | Tambah item nav SPV "Lokasi Outlet" |
| `apps/absensi/package.json` | Dep `leaflet` + `@types/leaflet` |

---

## Task 1: Konstanta & helper geofence (radius 30, ambang akurasi 75)

**Files:**
- Modify: `apps/absensi/src/lib/gps.ts`
- Test: `apps/absensi/src/lib/gps.test.ts`

**Interfaces:**
- Consumes: `haversineMeters(a,b)`, `isWithinRadius(center,point,r)` (sudah ada).
- Produces:
  - `GEOFENCE_RADIUS_M: number` (= 30)
  - `MAX_GPS_ACCURACY_M: number` (= 75)
  - `isGpsAccuracyAcceptable(accuracyM: number): boolean` → `accuracyM <= MAX_GPS_ACCURACY_M`

(Catatan: logika toleransi `max(0, jarak - akurasi) <= radius` tetap inline di
`useClockKiosk` & `submit-attendance` yang sudah ada — tidak diekstrak jadi helper
agar tidak ada kode mati. Test di bawah memverifikasi perilaku itu lewat
`haversineMeters` + `GEOFENCE_RADIUS_M` langsung.)

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `apps/absensi/src/lib/gps.test.ts`:

```typescript
import {
  haversineMeters, isWithinRadius,
  GEOFENCE_RADIUS_M, MAX_GPS_ACCURACY_M,
  isGpsAccuracyAcceptable,
} from "./gps";

describe("GEOFENCE_RADIUS_M", () => {
  test("is tightened to 30 meters", () => {
    expect(GEOFENCE_RADIUS_M).toBe(30);
  });
});

describe("isGpsAccuracyAcceptable", () => {
  test("accepts good accuracy", () => {
    expect(isGpsAccuracyAcceptable(20)).toBe(true);
  });
  test("accepts exactly at threshold (75)", () => {
    expect(isGpsAccuracyAcceptable(MAX_GPS_ACCURACY_M)).toBe(true);
  });
  test("rejects accuracy worse than threshold", () => {
    expect(isGpsAccuracyAcceptable(80)).toBe(false);
  });
});

describe("toleransi akurasi pada radius 30 (logika inline client/server)", () => {
  const outlet = { lat: -6.2, lng: 106.84 };
  // ~0.0004 deg lat ≈ 44.5 m utara
  const far = { lat: outlet.lat + 0.0004, lng: outlet.lng };
  const adjusted = (acc: number) => Math.max(0, haversineMeters(outlet, far) - acc);

  test("rejects 44m away with perfect accuracy (0)", () => {
    expect(adjusted(0) <= GEOFENCE_RADIUS_M).toBe(false);
  });
  test("accepts 44m away when accuracy 25m absorbs the gap", () => {
    // adjusted = max(0, ~44.5 - 25) ≈ 19.5 <= 30
    expect(adjusted(25) <= GEOFENCE_RADIUS_M).toBe(true);
  });
  test("accepts point at center regardless", () => {
    expect(Math.max(0, haversineMeters(outlet, outlet) - 0) <= GEOFENCE_RADIUS_M).toBe(true);
  });
});
```

(Hapus baris `import { haversineMeters, isWithinRadius } from "./gps";` lama di atas file agar tidak duplikat — gabungkan ke import baru.)

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `npx vitest run src/lib/gps.test.ts`
Expected: FAIL — `GEOFENCE_RADIUS_M` masih 150 dan `isGpsAccuracyAcceptable`/`isWithinAdjustedRadius` belum ada (TypeError / assertion 150 ≠ 30).

- [ ] **Step 3: Implementasi minimal di `gps.ts`**

Ubah baris `export const GEOFENCE_RADIUS_M = 150;` menjadi `30` dan perbarui komentar di atasnya. Lalu tambahkan helper baru setelah `isWithinRadius`:

```typescript
/**
 * Radius geofence absensi (meter) — sumber tunggal client & server.
 *
 * Diperketat ke 30 m setelah koordinat outlet dikalibrasi akurat lewat halaman
 * peta SPV (/dashboard/pengaturan-lokasi). GPS drift indoor dikompensasi
 * toleransi akurasi inline (max(0, jarak - akurasi) <= radius) + penolakan
 * akurasi buruk (MAX_GPS_ACCURACY_M). Outlet dengan lat/lng NULL dikecualikan.
 */
export const GEOFENCE_RADIUS_M = 30;

/**
 * Akurasi GPS terburuk (meter) yang masih boleh absen. Di atas ini, toleransi
 * akurasi akan "menelan" geofence 30 m → tolak & minta aktifkan Lokasi Akurat.
 */
export const MAX_GPS_ACCURACY_M = 75;

/** True bila akurasi GPS (meter) cukup baik untuk dipercaya absen. */
export function isGpsAccuracyAcceptable(accuracyM: number): boolean {
  return accuracyM <= MAX_GPS_ACCURACY_M;
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `npx vitest run src/lib/gps.test.ts`
Expected: PASS (semua test gps lulus).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/gps.ts apps/absensi/src/lib/gps.test.ts
git commit -m "feat(absensi): radius geofence 30m + helper toleransi & ambang akurasi GPS"
```

---

## Task 2: Hardening endpoint `/api/calibrate-outlet` (SPV-only + validasi)

**Files:**
- Modify: `apps/absensi/src/app/api/calibrate-outlet/route.ts`

**Interfaces:**
- Consumes: env `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Body `{ outlet_id: string, lat: number, lng: number }`. Header `Authorization: Bearer <access_token>`.
- Produces: respons `{ ok: true }` (200) atau `{ ok:false, error }` dengan status 400/401/403/500. Dikonsumsi Task 6.

- [ ] **Step 1: Ganti isi route dengan versi ber-auth**

Ganti SELURUH isi `apps/absensi/src/app/api/calibrate-outlet/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ROLES = new Set(["spv", "admin", "owner"]);

export async function POST(req: Request) {
  try {
    // 1. Verifikasi caller dari bearer token (bukan anon).
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
    }

    // 2. Cek role SPV/admin/owner.
    const { data: staff } = await admin
      .from("outlet_staff")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (!staff || !ALLOWED_ROLES.has(staff.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    // 3. Validasi payload.
    const body = await req.json();
    const { outlet_id, lat, lng } = body;
    if (!outlet_id || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ ok: false, error: "missing_or_invalid_params" }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ ok: false, error: "coords_out_of_range" }, { status: 400 });
    }

    // 4. Tulis koordinat (bypass RLS via service role).
    const { error } = await admin.from("outlets").update({ lat, lng }).eq("id", outlet_id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "internal_error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verifikasi type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru pada `calibrate-outlet/route.ts`.

- [ ] **Step 3: Smoke manual — tanpa token harus 403/401**

Run (dev server harus jalan, `npm run dev`):
```bash
curl -s -X POST http://localhost:3000/api/calibrate-outlet \
  -H "Content-Type: application/json" \
  -d '{"outlet_id":"550e8400-e29b-41d4-a716-446655440002","lat":-6.585,"lng":106.802}'
```
Expected: `{"ok":false,"error":"unauthenticated"}` (status 401). (Sebelumnya endpoint ini akan menulis tanpa cek — sekarang ditolak.)

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/api/calibrate-outlet/route.ts
git commit -m "fix(absensi): kunci /api/calibrate-outlet ke SPV (verifikasi token+role) + validasi koordinat"
```

---

## Task 3: Tolak akurasi GPS buruk di server (`submit-attendance`)

**Files:**
- Modify: `apps/absensi/src/app/api/submit-attendance/route.ts`

**Interfaces:**
- Consumes: `MAX_GPS_ACCURACY_M` dari `@/lib/gps` (Task 1). Body field `gps_accuracy`.
- Produces: respons `{ ok:false, reason:"gps_accuracy_low", accuracy_m }` (403) bila akurasi buruk. Dikonsumsi Task 4 (`gagalText`).

- [ ] **Step 1: Tambah import**

Di `apps/absensi/src/app/api/submit-attendance/route.ts` baris 3, ganti:

```typescript
import { haversineMeters, GEOFENCE_RADIUS_M } from "@/lib/gps";
```
menjadi:
```typescript
import { haversineMeters, GEOFENCE_RADIUS_M, MAX_GPS_ACCURACY_M } from "@/lib/gps";
```

- [ ] **Step 2: Tolak akurasi buruk sebelum cek jarak**

Di blok `if (outlet.lat !== null && outlet.lng !== null) {` (sekitar baris 32), tepat SETELAH baris `if (outlet.lat !== null && outlet.lng !== null) {` dan SEBELUM perhitungan `distanceM`, sisipkan:

```typescript
      // Tolak bila akurasi GPS sangat buruk — radius 30 m jadi tak bermakna
      // bila toleransi akurasi membengkak. Minta crew aktifkan Lokasi Akurat.
      const reportedAccuracy = Number(body.gps_accuracy ?? 0);
      if (reportedAccuracy > MAX_GPS_ACCURACY_M) {
        return NextResponse.json({
          ok: false,
          reason: "gps_accuracy_low",
          accuracy_m: reportedAccuracy,
        }, { status: 403 });
      }
```

- [ ] **Step 3: Verifikasi type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/api/submit-attendance/route.ts
git commit -m "feat(absensi): tolak absen server-side bila akurasi GPS > 75m"
```

---

## Task 4: Tolak akurasi GPS buruk di client (`useClockKiosk`)

**Files:**
- Modify: `apps/absensi/src/features/clock/useClockKiosk.ts`

**Interfaces:**
- Consumes: `isGpsAccuracyAcceptable`, `MAX_GPS_ACCURACY_M` dari `@/lib/gps` (Task 1). Reason `gps_accuracy_low` dari Task 3.
- Produces: tidak ada (perubahan UI lokal).

- [ ] **Step 1: Tambah import**

Di `apps/absensi/src/features/clock/useClockKiosk.ts` baris 16, ganti:

```typescript
import { haversineMeters, GEOFENCE_RADIUS_M } from "@/lib/gps";
```
menjadi:
```typescript
import { haversineMeters, GEOFENCE_RADIUS_M, MAX_GPS_ACCURACY_M, isGpsAccuracyAcceptable } from "@/lib/gps";
```

- [ ] **Step 2: Tolak akurasi buruk di callback `watchPosition`**

Di dalam callback sukses `watchPosition` (setelah `setDeviceAccuracy(accuracy);`, sebelum `if (!coords) {`), sisipkan:

```typescript
        // Akurasi GPS terlalu rendah → tolak tegas (jangan loloskan ke idle).
        if (!isGpsAccuracyAcceptable(accuracy)) {
          setResult({
            ok: false,
            message: `Akurasi GPS terlalu rendah (${accuracy.toFixed(0)} m, maksimal ${MAX_GPS_ACCURACY_M} m). Aktifkan "Lokasi Akurat/Precise" dan nyalakan GPS HP Anda, lalu coba lagi.`,
          });
          setPhase("location_invalid");
          return;
        }
```

- [ ] **Step 3: Map pesan reason `gps_accuracy_low`**

Di fungsi `gagalText` (akhir file), tambahkan entri dalam objek `map`:

```typescript
    gps_accuracy_low: "Akurasi GPS terlalu rendah — aktifkan Lokasi Akurat",
```

- [ ] **Step 4: Verifikasi type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error baru.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/features/clock/useClockKiosk.ts
git commit -m "feat(absensi): tolak absen client-side bila akurasi GPS > 75m + pesan jelas"
```

---

## Task 5: Komponen `OutletMapPicker` (Leaflet) + dependency

**Files:**
- Create: `apps/absensi/src/components/OutletMapPicker.tsx`
- Modify: `apps/absensi/package.json`

**Interfaces:**
- Consumes: `GEOFENCE_RADIUS_M` dari `@/lib/gps` (Task 1).
- Produces: default export komponen React
  `OutletMapPicker(props: { value: { lat: number; lng: number } | null; onChange: (lat: number, lng: number) => void })`.
  Dikonsumsi Task 6 via `dynamic(() => import(...), { ssr: false })`.

- [ ] **Step 1: Tambah dependency Leaflet**

Edit `apps/absensi/package.json` — tambahkan ke `dependencies`:
```json
    "leaflet": "^1.9.4",
```
dan ke `devDependencies`:
```json
    "@types/leaflet": "^1.9.12",
```

- [ ] **Step 2: Install**

Run (dari root repo `DIGITALISASI-SS-PROJECT/`): `yarn install`
Expected: `leaflet` & `@types/leaflet` terpasang tanpa error.

- [ ] **Step 3: Tulis komponen**

Buat `apps/absensi/src/components/OutletMapPicker.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEOFENCE_RADIUS_M } from "@/lib/gps";

// Fix ikon marker default (bundler tidak menyalin aset Leaflet otomatis).
const ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [-6.4, 106.82]; // Jabodetabek

type Props = {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
};

export default function OutletMapPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Inisialisasi peta sekali.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start = value ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
    const map = L.map(containerRef.current).setView([start.lat, start.lng], value ? 18 : 11);
    mapRef.current = map;

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19,
    });
    const sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri World Imagery", maxZoom: 19 },
    );
    sat.addTo(map); // default satelit agar atap gedung terlihat
    L.control.layers({ Satelit: sat, Jalan: osm }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: ICON }).addTo(map);
    markerRef.current = marker;
    const circle = L.circle([start.lat, start.lng], { radius: GEOFENCE_RADIUS_M, color: "#f29744" }).addTo(map);
    circleRef.current = circle;

    const emit = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      onChangeRef.current(lat, lng);
    };
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      circle.setLatLng(p);
      onChangeRef.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => emit(e.latlng.lat, e.latlng.lng));

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkron posisi marker bila `value` berubah dari luar (ganti outlet).
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current, circle = circleRef.current;
    if (!map || !marker || !circle || !value) return;
    marker.setLatLng([value.lat, value.lng]);
    circle.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], 18);
  }, [value]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl overflow-hidden border border-gray-200" />;
}
```

- [ ] **Step 4: Verifikasi type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error pada `OutletMapPicker.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/package.json apps/absensi/src/components/OutletMapPicker.tsx
git commit -m "feat(absensi): komponen OutletMapPicker (Leaflet OSM+satelit, pin draggable)"
```

---

## Task 6: Halaman `/dashboard/pengaturan-lokasi` (SPV-only) + nav

**Files:**
- Create: `apps/absensi/src/app/dashboard/pengaturan-lokasi/page.tsx`
- Modify: `apps/absensi/src/app/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ outletStaff: { id, outlet_id, role }, loading }`; `useToast()` → `{ show(kind, message) }`; `createClient()` dari `@/lib/supabase`; `OutletMapPicker` (Task 5); endpoint `/api/calibrate-outlet` (Task 2).
- Produces: route SPV-only.

- [ ] **Step 1: Tulis halaman**

Buat `apps/absensi/src/app/dashboard/pengaturan-lokasi/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@suka/auth";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";

const OutletMapPicker = dynamic(() => import("@/components/OutletMapPicker"), { ssr: false });

const ALLOWED_ROLES = ["spv", "admin", "owner"];
type Outlet = { id: string; name: string; lat: number | null; lng: number | null };

export default function PengaturanLokasiPage() {
  const { outletStaff, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const isAllowed = ALLOWED_ROLES.includes(outletStaff?.role || "");

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);

  // Guard SPV-only (defense-in-depth selain nav).
  useEffect(() => {
    if (!loading && outletStaff && !isAllowed) router.replace("/dashboard/kru");
  }, [loading, outletStaff, isAllowed, router]);

  // Muat daftar outlet.
  useEffect(() => {
    if (!isAllowed) return;
    supabase.from("outlets").select("id, name, lat, lng").order("name").then(({ data }) => {
      const rows = (data as Outlet[]) ?? [];
      setOutlets(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed, supabase]);

  // Set koordinat awal saat ganti outlet.
  useEffect(() => {
    const o = outlets.find((x) => x.id === selectedId);
    if (o) setCoords(o.lat !== null && o.lng !== null ? { lat: Number(o.lat), lng: Number(o.lng) } : null);
  }, [selectedId, outlets]);

  async function handleSave() {
    if (!selectedId || !coords) {
      toast.show("err", "Pilih outlet dan tentukan titik di peta dulu.");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.show("err", "Sesi habis, silakan login ulang."); return; }
      const res = await fetch("/api/calibrate-outlet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outlet_id: selectedId, lat: coords.lat, lng: coords.lng }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.show("ok", "Koordinat outlet tersimpan.");
        setOutlets((prev) => prev.map((o) => o.id === selectedId ? { ...o, lat: coords.lat, lng: coords.lng } : o));
      } else {
        toast.show("err", `Gagal: ${json.error ?? "tidak diketahui"}`);
      }
    } catch (e: any) {
      toast.show("err", `Gagal menyimpan: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Memuat…</div>;
  if (!isAllowed) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-suka-ink">Kalibrasi Lokasi Outlet</h1>
        <p className="text-sm text-gray-500">
          Geser pin ke gedung outlet sebenarnya (lihat dari satelit), lalu Simpan. Lingkaran oranye = radius absen 30 m.
        </p>
      </div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}{o.lat === null ? " (belum ada koordinat)" : ""}
          </option>
        ))}
      </select>

      <OutletMapPicker value={coords} onChange={(lat, lng) => setCoords({ lat, lng })} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {coords ? `Pin: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : "Klik peta untuk menaruh pin"}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !coords}
          className="px-4 py-2 rounded-lg bg-suka-orange text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan Koordinat"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Tambah item nav SPV**

Di `apps/absensi/src/app/dashboard/layout.tsx`, pada array `navItems` cabang `isSPV ? [ ... ]` (sekitar baris 28-35), tambahkan setelah item "Pengaturan Absensi":

```tsx
    { href: "/dashboard/pengaturan-lokasi", label: "Lokasi Outlet", icon: <MapPin size={20} /> },
```

Lalu pastikan `MapPin` diimport dari `lucide-react` di bagian import ikon di atas file (tambahkan `MapPin` ke daftar import `lucide-react` yang sudah ada).

- [ ] **Step 3: Verifikasi type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: tidak ada error.

- [ ] **Step 4: Verifikasi build**

Run: `npm run build`
Expected: build sukses; route `/dashboard/pengaturan-lokasi` muncul di output sebagai dynamic.

- [ ] **Step 5: Smoke manual**

Jalankan `npm run dev`, login sebagai SPV, buka `/dashboard/pengaturan-lokasi`:
- Dropdown berisi outlet; peta tampil dengan satelit; pin bisa digeser; toggle Satelit/Jalan jalan.
- Pilih outlet kasar (mis. CIBINONG), geser pin ke gedung, Simpan → toast sukses.
- Verifikasi DB: koordinat jadi 6 desimal:
```bash
curl -s 'https://khpkoreaaucvyqfhynfq.supabase.co/rest/v1/outlets?id=eq.550e8400-e29b-41d4-a716-446655440014&select=name,lat,lng' \
  -H 'apikey: <ANON_KEY>'
```
- Login sebagai crew → buka URL itu langsung → ter-redirect ke `/dashboard/kru`.

- [ ] **Step 6: Commit**

```bash
git add apps/absensi/src/app/dashboard/pengaturan-lokasi/page.tsx apps/absensi/src/app/dashboard/layout.tsx
git commit -m "feat(absensi): halaman kalibrasi lokasi outlet via peta (SPV-only) + nav"
```

---

## Task 7: Verifikasi akhir & rekap

**Files:** tidak ada perubahan kode.

- [ ] **Step 1: Seluruh test lulus**

Run: `npx vitest run`
Expected: semua test PASS (termasuk gps.test.ts baru).

- [ ] **Step 2: Type-check & build bersih**

Run: `npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 0 error, build sukses.

- [ ] **Step 3: Catat langkah operasional**

Konfirmasi ke pemilik: setelah deploy, SPV **wajib kalibrasi ulang 16 outlet** (semua kecuali KITCHEN PUSAT; HQ & CIBUBUR NULL by design) lewat halaman baru SEBELUM mengumumkan ke crew. Tanpa ini, radius 30 m pada koordinat lama justru menolak lebih sering.

---

## Catatan deploy

- App `absensi` perlu **redeploy** `absensi.sukashawarma.com` setelah merge (pola di CLAUDE.md §Deployment).
- Pastikan env `SUPABASE_SERVICE_ROLE_KEY` ada di server (sudah dipakai `submit-attendance` & `calibrate-outlet`).
- Tile peta (OSM + Esri) diakses dari browser klien — tidak butuh konfigurasi server / API key.
