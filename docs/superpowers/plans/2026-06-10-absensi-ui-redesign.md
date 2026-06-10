# Absensi UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesain app absensi `apps/absensi` jadi kiosk-first (auto-identify wajah 1:N + liveness acak + state IN/OUT pintar), hapus GPS end-to-end, ganti emoji→ikon, tambah Papan Kehadiran + export rekap.

**Architecture:** Next.js static export (client-side penuh). Logika murni (identify, liveness, board compute, CSV) dipisah ke unit teruji; UI/glue diberikan sebagai kode file lengkap + verifikasi `yarn type-check`/build + cek manual. Folder per-fitur (`features/clock|board|rekap`). Anti-curang = face match + liveness acak + selfie audit (GPS dibuang).

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `@suka/design-system`, `face-api.js`, `@suka/offline-queue`, Supabase, `lucide-react` (baru), Vitest (node), Deno (Edge Function).

Spec: [`docs/superpowers/specs/2026-06-10-absensi-ui-redesign-design.md`](../specs/2026-06-10-absensi-ui-redesign-design.md)

---

## File Structure

**Create:**
- `apps/absensi/src/lib/face/identify.ts` — fungsi murni `identifyStaff` (1:N).
- `apps/absensi/src/lib/face/identify.test.ts`
- `apps/absensi/src/lib/face/liveness.ts` — fitur liveness + detektor state-machine (murni).
- `apps/absensi/src/lib/face/liveness.test.ts`
- `apps/absensi/src/lib/feedback/toast.tsx` — ToastProvider + useToast.
- `apps/absensi/src/lib/feedback/sound.ts` — bunyi sukses/gagal (Web Audio).
- `apps/absensi/src/features/clock/useClockKiosk.ts` — hook state-machine kiosk.
- `apps/absensi/src/features/board/board.ts` — `computeBoard` murni + tipe.
- `apps/absensi/src/features/board/board.test.ts`
- `apps/absensi/src/features/rekap/csv.ts` — `attendanceToCsv` murni.
- `apps/absensi/src/features/rekap/csv.test.ts`
- `packages/design-system/src/components/StatusPill.tsx`
- `packages/design-system/src/components/Avatar.tsx`
- `packages/design-system/src/components/EmptyState.tsx`
- `packages/design-system/src/components/Spinner.tsx`

**Modify:**
- `apps/absensi/package.json` — tambah `lucide-react`.
- `apps/absensi/src/lib/attendance/types.ts` — GPS opsional.
- `apps/absensi/src/app/clock/page.tsx` — ganti total jadi kiosk.
- `apps/absensi/src/app/dashboard/page.tsx` — Papan Kehadiran.
- `apps/absensi/src/app/rekap/page.tsx` — ringkasan + selfie + export.
- `apps/absensi/src/app/enroll/page.tsx` — poles ikon.
- `apps/absensi/src/components/Navbar.tsx` — ikon.
- `apps/absensi/src/app/layout.tsx` — bungkus ToastProvider.
- `packages/design-system/src/components/index.ts` — export primitif baru.
- `supabase/functions/submit-attendance/index.ts` — hapus GPS.

---

## Task 1: Install lucide-react

**Files:**
- Modify: `apps/absensi/package.json`

- [ ] **Step 1: Tambah dependency**

Run (dari root repo):
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi add lucide-react
```
Expected: `lucide-react` masuk `apps/absensi/package.json` dependencies, lockfile terupdate.

- [ ] **Step 2: Verifikasi resolve**

Run:
```bash
node -e "require.resolve('lucide-react', {paths:['/c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/apps/absensi']}); console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/package.json yarn.lock && git commit -m "build(absensi): tambah lucide-react untuk ikon (ganti emoji)"
```

---

## Task 2: Design-system — StatusPill

**Files:**
- Create: `packages/design-system/src/components/StatusPill.tsx`
- Modify: `packages/design-system/src/components/index.ts`

StatusPill dipakai di board & rekap. Murni styling (tanpa ikon — ikon ditambah di app-level via `children`/wrapper). Warna selaras brand.

- [ ] **Step 1: Buat komponen**

Create `packages/design-system/src/components/StatusPill.tsx`:
```tsx
import React from 'react'
import { cn } from '../utils/cn'

export type StatusKind =
  | 'tepat' | 'telat' | 'alpha' | 'belum' | 'masuk' | 'keluar'

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind
}

const STYLES: Record<StatusKind, string> = {
  tepat:  'bg-[#e1f5ee] text-[#085041]',
  masuk:  'bg-[#e1f5ee] text-[#085041]',
  telat:  'bg-[#faeeda] text-[#854f0b]',
  alpha:  'bg-[#fce? ]', // placeholder — diganti di bawah
  belum:  'bg-[#f1efe8] text-[#5f5e5a]',
  keluar: 'bg-[#eef0ff] text-[#26215c]',
}

export const StatusPill: React.FC<StatusPillProps> = ({ kind, className, children, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full',
      STYLES[kind],
      className,
    )}
    {...props}
  >
    {children}
  </span>
)
StatusPill.displayName = 'StatusPill'
```

- [ ] **Step 2: Perbaiki map warna (hapus placeholder)**

Ganti seluruh objek `STYLES` dengan versi final:
```tsx
const STYLES: Record<StatusKind, string> = {
  tepat:  'bg-[#e1f5ee] text-[#085041]',
  masuk:  'bg-[#e1f5ee] text-[#085041]',
  telat:  'bg-[#faeeda] text-[#854f0b]',
  alpha:  'bg-[#fcebeb] text-[#a32d2d]',
  belum:  'bg-[#f1efe8] text-[#5f5e5a]',
  keluar: 'bg-[#eef0ff] text-[#26215c]',
}
```

- [ ] **Step 3: Export**

Edit `packages/design-system/src/components/index.ts`, tambah baris:
```ts
export { StatusPill } from './StatusPill'
export type { StatusKind } from './StatusPill'
```

- [ ] **Step 4: Type-check design-system**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/design-system type-check
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src/components/StatusPill.tsx packages/design-system/src/components/index.ts && git commit -m "feat(design-system): StatusPill untuk status absensi"
```

---

## Task 3: Design-system — Avatar, EmptyState, Spinner

**Files:**
- Create: `packages/design-system/src/components/Avatar.tsx`, `EmptyState.tsx`, `Spinner.tsx`
- Modify: `packages/design-system/src/components/index.ts`

- [ ] **Step 1: Avatar (inisial dari nama)**

Create `packages/design-system/src/components/Avatar.tsx`:
```tsx
import React from 'react'
import { cn } from '../utils/cn'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  size?: number
}

export const Avatar: React.FC<AvatarProps> = ({ name, size = 36, className, style, ...props }) => (
  <div
    className={cn('flex items-center justify-center rounded-full bg-suka-cream text-suka-brown font-medium', className)}
    style={{ width: size, height: size, fontSize: size * 0.36, ...style }}
    aria-hidden="true"
    {...props}
  >
    {initials(name)}
  </div>
)
Avatar.displayName = 'Avatar'
```

- [ ] **Step 2: EmptyState (ikon disuplai app via prop)**

Create `packages/design-system/src/components/EmptyState.tsx`:
```tsx
import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    {icon && <div className="text-suka-gray-400">{icon}</div>}
    <p className="font-medium text-suka-ink">{title}</p>
    {description && <p className="text-sm text-suka-gray-500">{description}</p>}
  </div>
)
EmptyState.displayName = 'EmptyState'
```

- [ ] **Step 3: Spinner (CSS murni)**

Create `packages/design-system/src/components/Spinner.tsx`:
```tsx
import React from 'react'
import { cn } from '../utils/cn'

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <span
    role="status"
    aria-label="Memuat"
    className={cn('inline-block animate-spin rounded-full border-2 border-suka-gray-200 border-t-suka-orange', className)}
    style={{ width: size, height: size }}
  />
)
Spinner.displayName = 'Spinner'
```

- [ ] **Step 4: Export ketiganya**

Edit `packages/design-system/src/components/index.ts`, tambah:
```ts
export { Avatar } from './Avatar'
export { EmptyState } from './EmptyState'
export { Spinner } from './Spinner'
```

- [ ] **Step 5: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/design-system type-check
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/design-system/src/components/ && git commit -m "feat(design-system): Avatar, EmptyState, Spinner"
```

---

## Task 4: Edge Function — hapus GPS

**Files:**
- Modify: `supabase/functions/submit-attendance/index.ts`

Buang validasi GPS & radius. Insert `gps_lat/gps_lng/distance_m` = null. Pertahankan authz/role/outlet/enroll/selfie-path/status/idempotency.

- [ ] **Step 1: Hapus validasi GPS**

Di `supabase/functions/submit-attendance/index.ts`, HAPUS blok ini seluruhnya:
```ts
    // Fix 2: Validate GPS is a real number (prevent NaN radius bypass).
    if (
      typeof body.gps_lat !== "number" || typeof body.gps_lng !== "number" ||
      Number.isNaN(body.gps_lat) || Number.isNaN(body.gps_lng)
    ) {
      return json(400, { ok: false, reason: "invalid_gps" });
    }
```

- [ ] **Step 2: Hapus fetch outlet/lat-lng & radius + cabang outside_radius**

HAPUS blok ini:
```ts
    // Lokasi outlet + config.
    const { data: outlet } = await admin
      .from("outlets").select("lat,lng").eq("id", caller.outlet_id).single();
    const { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,toleransi_menit,radius_m")
      .eq("outlet_id", caller.outlet_id).single();
    if (!outlet || !cfg) return json(500, { ok: false, reason: "config_missing" });

    const distance = Math.round(
      haversineMeters({ lat: outlet.lat, lng: outlet.lng }, { lat: body.gps_lat, lng: body.gps_lng }),
    );
    if (distance > cfg.radius_m) {
      return json(200, { ok: false, reason: "outside_radius", distance_m: distance });
    }
```
GANTI dengan (config tetap diambil untuk jam_masuk/toleransi, tanpa radius/lat/lng):
```ts
    // Config jam kerja (tanpa GPS/radius — absensi di device outlet).
    const { data: cfg } = await admin
      .from("outlet_attendance_config")
      .select("jam_masuk,toleransi_menit")
      .eq("outlet_id", caller.outlet_id).single();
    if (!cfg) return json(500, { ok: false, reason: "config_missing" });
```

- [ ] **Step 3: Insert tanpa GPS**

Pada objek `admin.from("attendance").upsert({...})`, GANTI tiga baris GPS:
```ts
      gps_lat: body.gps_lat,
      gps_lng: body.gps_lng,
      distance_m: distance,
```
MENJADI:
```ts
      gps_lat: null,
      gps_lng: null,
      distance_m: null,
```

- [ ] **Step 4: Hapus respons sukses field distance & import haversine**

Pada baris return sukses, GANTI:
```ts
    return json(200, { ok: true, status, distance_m: distance, ts_server: tsServer, attendance_id: body.id });
```
MENJADI:
```ts
    return json(200, { ok: true, status, ts_server: tsServer, attendance_id: body.id });
```
Lalu HAPUS baris import di atas file:
```ts
import { haversineMeters } from "../_shared/haversine.ts";
```
Dan pada `type Body`, ubah `gps_lat`/`gps_lng` jadi opsional:
```ts
  gps_lat?: number;
  gps_lng?: number;
```

- [ ] **Step 5: Type-check Deno**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/supabase/functions/submit-attendance && deno check index.ts
```
Expected: no errors. (Jika `deno` tak terpasang, lewati & andalkan review manual bahwa tak ada referensi `haversineMeters`/`distance`/`outlet.lat` tersisa.)

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/submit-attendance/index.ts && git commit -m "feat(edge): hapus validasi GPS/radius dari submit-attendance"
```

---

## Task 5: types.ts — GPS opsional

**Files:**
- Modify: `apps/absensi/src/lib/attendance/types.ts`

- [ ] **Step 1: Jadikan GPS opsional**

Di `apps/absensi/src/lib/attendance/types.ts`, pada `AttendancePayload`, GANTI:
```ts
  gps_lat: number;
  gps_lng: number;
  match_distance: number;
```
MENJADI:
```ts
  gps_lat?: number | null;
  gps_lng?: number | null;
  match_distance: number;
```
Dan pada `SubmitResult` sukses, HAPUS `distance_m`:
```ts
  | { ok: true; status: "tepat" | "telat"; distance_m: number; ts_server: string; attendance_id: string }
```
MENJADI:
```ts
  | { ok: true; status: "tepat" | "telat"; ts_server: string; attendance_id: string }
```

- [ ] **Step 2: Type-check app**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no errors (clock lama tetap kompatibel karena GPS jadi opsional; clock diganti total di Task 13). Step berikut hanya membersihkan logika `outside_radius` yang sudah mati.

- [ ] **Step 3: Perbaiki useAttendanceQueue (hapus cek outside_radius)**

Di `apps/absensi/src/lib/attendance/useAttendanceQueue.ts`, GANTI baris:
```ts
        if (!res.ok && res.reason !== "outside_radius") throw new Error(res.reason);
```
MENJADI:
```ts
        if (!res.ok) throw new Error(res.reason);
```

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/lib/attendance/types.ts apps/absensi/src/lib/attendance/useAttendanceQueue.ts && git commit -m "refactor(absensi): GPS opsional di payload, hapus cabang outside_radius"
```

---

## Task 6: lib/face/identify.ts — identifikasi 1:N (TDD)

**Files:**
- Create: `apps/absensi/src/lib/face/identify.ts`
- Test: `apps/absensi/src/lib/face/identify.test.ts`

Fungsi murni: dari descriptor live + kandidat staff, kembalikan staff terdekat bila ≤ threshold.

- [ ] **Step 1: Tulis test gagal**

Create `apps/absensi/src/lib/face/identify.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { identifyStaff } from "./identify";

const A = [0, 0, 0];
const B = [1, 1, 1];

describe("identifyStaff", () => {
  it("mengembalikan kandidat terdekat di bawah threshold", () => {
    const r = identifyStaff([0.1, 0, 0], [
      { id: "a", name: "A", descriptor: A },
      { id: "b", name: "B", descriptor: B },
    ], 0.5);
    expect(r?.id).toBe("a");
    expect(r?.distance).toBeCloseTo(0.1, 5);
  });

  it("null bila semua kandidat di atas threshold", () => {
    const r = identifyStaff([5, 5, 5], [{ id: "a", name: "A", descriptor: A }], 0.5);
    expect(r).toBeNull();
  });

  it("null bila tidak ada kandidat", () => {
    expect(identifyStaff([0, 0, 0], [], 0.5)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/lib/face/identify.test.ts
```
Expected: FAIL (`identifyStaff` belum ada).

- [ ] **Step 3: Implementasi**

Create `apps/absensi/src/lib/face/identify.ts`:
```ts
import { euclideanDistance, DEFAULT_MATCH_THRESHOLD, type Descriptor } from "./match";

export type Candidate = { id: string; name: string; descriptor: Descriptor };
export type IdentifyResult = { id: string; name: string; distance: number };

/** Cari kandidat terdekat (1:N). Null bila tak ada / semua di atas threshold. */
export function identifyStaff(
  live: Descriptor,
  candidates: Candidate[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): IdentifyResult | null {
  let best: IdentifyResult | null = null;
  for (const c of candidates) {
    const distance = euclideanDistance(live, c.descriptor);
    if (distance <= threshold && (best === null || distance < best.distance)) {
      best = { id: c.id, name: c.name, distance };
    }
  }
  return best;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/lib/face/identify.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/face/identify.ts apps/absensi/src/lib/face/identify.test.ts && git commit -m "feat(absensi): identifikasi wajah 1:N (identifyStaff)"
```

---

## Task 7: lib/face/liveness.ts — fitur + detektor (TDD)

**Files:**
- Create: `apps/absensi/src/lib/face/liveness.ts`
- Test: `apps/absensi/src/lib/face/liveness.test.ts`

Detektor state-machine murni atas urutan `LivenessFeatures`. Setiap tantangan butuh transisi dua-fase → foto diam tak bisa lolos. Ekstraksi fitur dari landmark face-api dipisah (fungsi `featuresFromLandmarks`) — diuji terbatas pada EAR.

- [ ] **Step 1: Tulis test gagal**

Create `apps/absensi/src/lib/face/liveness.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createLivenessDetector, type LivenessFeatures } from "./liveness";

const F = (ear: number, noseX = 0.5, noseY = 0.5): LivenessFeatures => ({ ear, noseX, noseY });

describe("liveness blink", () => {
  it("lolos saat mata terbuka→tertutup→terbuka", () => {
    const d = createLivenessDetector("blink");
    expect(d.feed(F(0.3))).toBe(false); // open
    expect(d.feed(F(0.1))).toBe(false); // closed
    expect(d.feed(F(0.3))).toBe(true);  // open again → pass
  });
  it("tidak lolos bila mata selalu terbuka (foto diam)", () => {
    const d = createLivenessDetector("blink");
    for (let i = 0; i < 10; i++) expect(d.feed(F(0.3))).toBe(false);
  });
});

describe("liveness turn-left", () => {
  it("lolos saat hidung geser kiri lalu kembali", () => {
    const d = createLivenessDetector("turn-left");
    expect(d.feed(F(0.3, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.3))).toBe(false); // turned
    expect(d.feed(F(0.3, 0.5))).toBe(true);  // centered → pass
  });
});

describe("liveness nod", () => {
  it("lolos saat hidung turun lalu naik", () => {
    const d = createLivenessDetector("nod");
    expect(d.feed(F(0.3, 0.5, 0.5))).toBe(false);
    expect(d.feed(F(0.3, 0.5, 0.7))).toBe(false); // down
    expect(d.feed(F(0.3, 0.5, 0.5))).toBe(true);  // up → pass
  });
});

describe("idempotensi setelah lolos", () => {
  it("tetap true setelah lolos", () => {
    const d = createLivenessDetector("blink");
    d.feed(F(0.3)); d.feed(F(0.1));
    expect(d.feed(F(0.3))).toBe(true);
    expect(d.feed(F(0.3))).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/lib/face/liveness.test.ts
```
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi**

Create `apps/absensi/src/lib/face/liveness.ts`:
```ts
export type Challenge = "blink" | "turn-left" | "turn-right" | "nod";
export type LivenessFeatures = { ear: number; noseX: number; noseY: number };

export const CHALLENGE_LABEL: Record<Challenge, string> = {
  "blink": "Kedipkan mata",
  "turn-left": "Tolehkan kepala ke kiri",
  "turn-right": "Tolehkan kepala ke kanan",
  "nod": "Anggukkan kepala",
};

const EAR_CLOSED = 0.18;
const EAR_OPEN = 0.26;
const TURN_LO = 0.4;   // hidung geser ke kiri frame
const TURN_HI = 0.6;   // hidung geser ke kanan frame
const CENTER_LO = 0.45;
const CENTER_HI = 0.55;
const NOD_DOWN = 0.6;
const NOD_UP = 0.55;

/** Pilih tantangan acak (default Math.random; rng dapat di-inject untuk test). */
export function pickChallenge(rng: () => number = Math.random): Challenge {
  const all: Challenge[] = ["blink", "turn-left", "turn-right", "nod"];
  return all[Math.floor(rng() * all.length)]!;
}

/** Detektor stateful: feed fitur per-frame; return true sekali tantangan terpenuhi (sticky). */
export function createLivenessDetector(challenge: Challenge) {
  let phase = 0; // 0 = menunggu aksi, 1 = menunggu kembali, 2 = lolos
  function feed(f: LivenessFeatures): boolean {
    if (phase === 2) return true;
    switch (challenge) {
      case "blink":
        if (phase === 0 && f.ear < EAR_CLOSED) phase = 1;
        else if (phase === 1 && f.ear > EAR_OPEN) phase = 2;
        break;
      case "turn-left":
        if (phase === 0 && f.noseX < TURN_LO) phase = 1;
        else if (phase === 1 && f.noseX >= CENTER_LO && f.noseX <= CENTER_HI) phase = 2;
        break;
      case "turn-right":
        if (phase === 0 && f.noseX > TURN_HI) phase = 1;
        else if (phase === 1 && f.noseX >= CENTER_LO && f.noseX <= CENTER_HI) phase = 2;
        break;
      case "nod":
        if (phase === 0 && f.noseY > NOD_DOWN) phase = 1;
        else if (phase === 1 && f.noseY < NOD_UP) phase = 2;
        break;
    }
    return phase === 2;
  }
  return { feed };
}

type Pt = { x: number; y: number };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Eye-Aspect-Ratio dari 6 titik mata face-api (urut p1..p6). */
export function eyeAspectRatio(p: Pt[]): number {
  const [p1, p2, p3, p4, p5, p6] = p as [Pt, Pt, Pt, Pt, Pt, Pt];
  const horiz = dist(p1, p4);
  if (horiz === 0) return 0;
  return (dist(p2, p6) + dist(p3, p5)) / (2 * horiz);
}

/**
 * Ekstrak fitur liveness dari hasil face-api WithFaceLandmarks.
 * `det` punya .landmarks (getLeftEye/getRightEye/getNose) & .detection.box.
 */
export function featuresFromLandmarks(det: {
  landmarks: { getLeftEye(): Pt[]; getRightEye(): Pt[]; getNose(): Pt[] };
  detection: { box: { x: number; y: number; width: number; height: number } };
}): LivenessFeatures {
  const ear = (eyeAspectRatio(det.landmarks.getLeftEye()) + eyeAspectRatio(det.landmarks.getRightEye())) / 2;
  const nose = det.landmarks.getNose();
  const tip = nose[nose.length - 1]!; // ujung hidung
  const box = det.detection.box;
  const noseX = box.width ? (tip.x - box.x) / box.width : 0.5;
  const noseY = box.height ? (tip.y - box.y) / box.height : 0.5;
  return { ear, noseX, noseY };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/lib/face/liveness.test.ts
```
Expected: PASS (semua test).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/face/liveness.ts apps/absensi/src/lib/face/liveness.test.ts && git commit -m "feat(absensi): liveness acak (blink/turn/nod) detektor murni"
```

---

## Task 8: features/board — computeBoard (TDD)

**Files:**
- Create: `apps/absensi/src/features/board/board.ts`
- Test: `apps/absensi/src/features/board/board.test.ts`

Gabung daftar staff dengan record absensi hari ini → status per staff + hitung ringkasan.

- [ ] **Step 1: Tulis test gagal**

Create `apps/absensi/src/features/board/board.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeBoard, type BoardStaff, type BoardRecord } from "./board";

const staff: BoardStaff[] = [
  { id: "1", name: "Budi", role: "crew" },
  { id: "2", name: "Sari", role: "kasir" },
  { id: "3", name: "Andi", role: "crew" },
];

const records: BoardRecord[] = [
  { outlet_staff_id: "1", type: "in", status: "tepat", ts_server: "2026-06-10T09:01:00+07:00" },
  { outlet_staff_id: "2", type: "in", status: "telat", ts_server: "2026-06-10T09:22:00+07:00" },
];

describe("computeBoard", () => {
  it("memetakan status & jam per staff", () => {
    const { rows } = computeBoard(staff, records);
    expect(rows.find(r => r.id === "1")?.state).toBe("masuk");
    expect(rows.find(r => r.id === "2")?.state).toBe("telat");
    expect(rows.find(r => r.id === "3")?.state).toBe("belum");
  });

  it("staff dengan in lalu out → keluar", () => {
    const { rows } = computeBoard(staff, [
      ...records,
      { outlet_staff_id: "1", type: "out", status: "tepat", ts_server: "2026-06-10T17:05:00+07:00" },
    ]);
    expect(rows.find(r => r.id === "1")?.state).toBe("keluar");
  });

  it("menghitung ringkasan", () => {
    const { summary } = computeBoard(staff, records);
    expect(summary).toEqual({ hadir: 2, telat: 1, belum: 1, total: 3 });
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/features/board/board.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implementasi**

Create `apps/absensi/src/features/board/board.ts`:
```ts
export type BoardStaff = { id: string; name: string; role: string };
export type BoardRecord = {
  outlet_staff_id: string;
  type: "in" | "out";
  status: "tepat" | "telat" | "alpha";
  ts_server: string;
};

export type BoardState = "masuk" | "telat" | "keluar" | "belum";
export type BoardRow = { id: string; name: string; role: string; state: BoardState; time: string | null };
export type BoardSummary = { hadir: number; telat: number; belum: number; total: number };

function jam(ts: string): string {
  return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Hitung papan kehadiran: status terbaru tiap staff + ringkasan. */
export function computeBoard(staff: BoardStaff[], records: BoardRecord[]): {
  rows: BoardRow[];
  summary: BoardSummary;
} {
  const byStaff = new Map<string, BoardRecord[]>();
  for (const r of records) {
    const arr = byStaff.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    byStaff.set(r.outlet_staff_id, arr);
  }

  const rows: BoardRow[] = staff.map((s) => {
    const recs = (byStaff.get(s.id) ?? []).slice().sort((a, b) => a.ts_server.localeCompare(b.ts_server));
    const inRec = recs.find((r) => r.type === "in");
    const outRec = recs.filter((r) => r.type === "out").pop();
    if (outRec) return { id: s.id, name: s.name, role: s.role, state: "keluar", time: jam(outRec.ts_server) };
    if (inRec) {
      const state: BoardState = inRec.status === "telat" ? "telat" : "masuk";
      return { id: s.id, name: s.name, role: s.role, state, time: jam(inRec.ts_server) };
    }
    return { id: s.id, name: s.name, role: s.role, state: "belum", time: null };
  });

  const summary: BoardSummary = {
    hadir: rows.filter((r) => r.state === "masuk" || r.state === "keluar").length,
    telat: rows.filter((r) => r.state === "telat").length,
    belum: rows.filter((r) => r.state === "belum").length,
    total: staff.length,
  };
  return { rows, summary };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/features/board/board.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/features/board/board.ts apps/absensi/src/features/board/board.test.ts && git commit -m "feat(absensi): computeBoard untuk papan kehadiran"
```

---

## Task 9: features/rekap — attendanceToCsv (TDD)

**Files:**
- Create: `apps/absensi/src/features/rekap/csv.ts`
- Test: `apps/absensi/src/features/rekap/csv.test.ts`

- [ ] **Step 1: Tulis test gagal**

Create `apps/absensi/src/features/rekap/csv.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { attendanceToCsv, type CsvRow } from "./csv";

const rows: CsvRow[] = [
  { name: "Budi", type: "in", jam: "09:01", status: "tepat" },
  { name: 'Sari, "kasir"', type: "in", jam: "09:22", status: "telat" },
];

describe("attendanceToCsv", () => {
  it("menulis header + baris", () => {
    const csv = attendanceToCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Nama,Tipe,Jam,Status");
    expect(lines[1]).toBe("Budi,in,09:01,tepat");
  });
  it("escape koma & tanda kutip", () => {
    const csv = attendanceToCsv(rows);
    expect(csv.split("\n")[2]).toBe('"Sari, ""kasir""",in,09:22,telat');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/features/rekap/csv.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implementasi**

Create `apps/absensi/src/features/rekap/csv.ts`:
```ts
export type CsvRow = { name: string; type: string; jam: string; status: string };

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serialisasi baris rekap ke CSV (header Indonesia). */
export function attendanceToCsv(rows: CsvRow[]): string {
  const header = "Nama,Tipe,Jam,Status";
  const body = rows.map((r) => [r.name, r.type, r.jam, r.status].map(esc).join(","));
  return [header, ...body].join("\n");
}

/** Trigger unduhan file CSV di browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test src/features/rekap/csv.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/features/rekap/csv.ts apps/absensi/src/features/rekap/csv.test.ts && git commit -m "feat(absensi): export CSV rekap kehadiran"
```

---

## Task 10: lib/feedback — Toast + bunyi

**Files:**
- Create: `apps/absensi/src/lib/feedback/toast.tsx`, `apps/absensi/src/lib/feedback/sound.ts`
- Modify: `apps/absensi/src/app/layout.tsx`

- [ ] **Step 1: Bunyi (Web Audio, tanpa aset)**

Create `apps/absensi/src/lib/feedback/sound.ts`:
```ts
"use client";

/** Bunyi pendek konfirmasi. type 'ok' = nada naik, 'err' = nada turun. */
export function beep(type: "ok" | "err" = "ok"): void {
  try {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = type === "ok" ? 660 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* abaikan; bunyi opsional */
  }
}
```

- [ ] **Step 2: ToastProvider**

Create `apps/absensi/src/lib/feedback/toast.tsx`:
```tsx
"use client";

import React, { createContext, useContext, useCallback, useState } from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { beep } from "./sound";

type ToastKind = "ok" | "err" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<{ show: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    if (kind !== "info") beep(kind);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => {
          const Icon = t.kind === "ok" ? CircleCheck : t.kind === "err" ? CircleX : Info;
          const color = t.kind === "ok" ? "text-suka-green" : t.kind === "err" ? "text-red-600" : "text-suka-brown";
          return (
            <div key={t.id} className="flex items-center gap-2 bg-white border border-suka-gray-200 rounded-lg shadow-lg px-4 py-2.5">
              <Icon className={color} size={18} />
              <span className="text-sm text-suka-ink">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast harus di dalam ToastProvider");
  return ctx;
}
```

- [ ] **Step 3: Bungkus layout dengan ToastProvider**

Di `apps/absensi/src/app/layout.tsx`, tambah import:
```tsx
import { ToastProvider } from '@/lib/feedback/toast'
```
Lalu bungkus, GANTI:
```tsx
          <AuthProvider>
            <AuthGuard>
              <Navbar />
              {children}
            </AuthGuard>
          </AuthProvider>
```
MENJADI:
```tsx
          <AuthProvider>
            <ToastProvider>
              <AuthGuard>
                <Navbar />
                {children}
              </AuthGuard>
            </ToastProvider>
          </AuthProvider>
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no new errors dari feedback (error clock lama masih ada sampai Task 11).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/feedback/ apps/absensi/src/app/layout.tsx && git commit -m "feat(absensi): Toast + bunyi konfirmasi global"
```

---

## Task 11: Navbar — ganti emoji jadi ikon

**Files:**
- Modify: `apps/absensi/src/components/Navbar.tsx`

- [ ] **Step 1: Ganti links & brand pakai lucide**

Di `apps/absensi/src/components/Navbar.tsx`, tambah import di atas:
```tsx
import { Clock, Camera, ClipboardList, LayoutDashboard, LogOut } from 'lucide-react';
```
GANTI array `links`:
```tsx
  const links = [
    { href: '/clock',   label: '🕐 Absensi' },
    { href: '/enroll',  label: '📷 Enroll' },
    { href: '/rekap',   label: '📋 Rekap' },
  ];
```
MENJADI:
```tsx
  const links = [
    { href: '/dashboard', label: 'Papan', Icon: LayoutDashboard },
    { href: '/clock',     label: 'Absensi', Icon: Clock },
    { href: '/enroll',    label: 'Enroll', Icon: Camera },
    { href: '/rekap',     label: 'Rekap', Icon: ClipboardList },
  ];
```

- [ ] **Step 2: Render ikon di link & brand & logout**

GANTI blok brand:
```tsx
        <span className="font-bold text-suka-brown text-sm">🥙 Sukashawarma</span>
```
MENJADI:
```tsx
        <span className="font-bold text-suka-brown text-sm">Sukashawarma</span>
```
GANTI blok map links:
```tsx
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === href
                ? 'bg-suka-orange text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        ))}
```
MENJADI:
```tsx
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
              pathname === href
                ? 'bg-suka-orange text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
```
GANTI tombol logout:
```tsx
      <button
        onClick={handleLogout}
        className="px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition border border-red-200"
      >
        Keluar →
      </button>
```
MENJADI:
```tsx
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition border border-red-200"
      >
        <LogOut size={16} /> Keluar
      </button>
```

- [ ] **Step 3: Type-check + cek visual**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no error di Navbar. Lalu buka `localhost:3000` (dev server), pastikan navbar tampil ikon (bukan emoji).

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/components/Navbar.tsx && git commit -m "feat(absensi): navbar pakai ikon lucide (hapus emoji)"
```

---

## Task 12: Clock kiosk — hook state machine

**Files:**
- Create: `apps/absensi/src/features/clock/useClockKiosk.ts`

Hook ini mengatur: load staff+descriptor, loop deteksi wajah, identify 1:N, tentukan IN/OUT dari record hari ini, jalankan liveness, capture+submit. Tidak di-unit-test (glue browser) — diverifikasi via type-check + E2E manual di Task 13.

- [ ] **Step 1: Tulis hook**

Create `apps/absensi/src/features/clock/useClockKiosk.ts`:
```ts
"use client";

import { useCallback, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { captureFrame } from "@/components/CameraCapture";
import { identifyStaff, type Candidate } from "@/lib/face/identify";
import {
  createLivenessDetector, featuresFromLandmarks, pickChallenge,
  CHALLENGE_LABEL, type Challenge,
} from "@/lib/face/liveness";
import { submitAttendance } from "@/lib/attendance/submit";
import { useAttendanceQueue } from "@/lib/attendance/useAttendanceQueue";
import type { AttendancePayload } from "@/lib/attendance/types";

export type KioskPhase = "idle" | "identified" | "liveness" | "submitting" | "result";
export type KioskResult = { ok: boolean; message: string };

type StaffRow = { id: string; name: string; face_descriptor: number[] | null };

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;
const DETECT_OPTS = new faceapi.TinyFaceDetectorOptions();

export function useClockKiosk() {
  const { outletStaff, session } = useAuth();
  const supabase = createClient();
  const queue = useAttendanceQueue();

  const candidatesRef = useRef<Candidate[]>([]);
  const [phase, setPhase] = useState<KioskPhase>("idle");
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [result, setResult] = useState<KioskResult | null>(null);
  const busyRef = useRef(false);

  /** Muat descriptor staff ter-enroll (panggil sekali setelah outletStaff siap). */
  const loadCandidates = useCallback(async () => {
    if (!outletStaff) return;
    const { data } = await supabase
      .from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletStaff.outlet_id)
      .not("face_descriptor", "is", null);
    candidatesRef.current = ((data as StaffRow[]) ?? [])
      .filter((s) => s.face_descriptor)
      .map((s) => ({ id: s.id, name: s.name, descriptor: s.face_descriptor! }));
  }, [outletStaff, supabase]);

  /** Tentukan aksi IN/OUT dari record hari ini. */
  const decideAction = useCallback(async (staffId: string): Promise<"in" | "out" | "done"> => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("type")
      .eq("outlet_staff_id", staffId)
      .gte("ts_server", `${today}T00:00:00`)
      .lte("ts_server", `${today}T23:59:59`);
    const types = (data as { type: string }[] ?? []).map((r) => r.type);
    const hasIn = types.includes("in");
    const hasOut = types.includes("out");
    if (!hasIn) return "in";
    if (!hasOut) return "out";
    return "done";
  }, [supabase]);

  /** Dipanggil per-frame oleh layar saat phase idle: deteksi + identify. */
  const tick = useCallback(async (video: HTMLVideoElement) => {
    if (busyRef.current || phase !== "idle" || !outletStaff) return;
    busyRef.current = true;
    try {
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks().withFaceDescriptor();
      if (!det) return;
      const found = identifyStaff(Array.from(det.descriptor), candidatesRef.current);
      if (!found) return;
      const next = await decideAction(found.id);
      if (next === "done") {
        setWho({ id: found.id, name: found.name });
        setResult({ ok: true, message: `${found.name} sudah absen masuk & keluar hari ini` });
        setPhase("result");
        scheduleReset();
        return;
      }
      setWho({ id: found.id, name: found.name });
      setAction(next);
      setChallenge(pickChallenge());
      setPhase("identified");
      setTimeout(() => setPhase("liveness"), 900); // jeda salam "Halo, Nama"
    } finally {
      busyRef.current = false;
    }
  }, [phase, outletStaff, decideAction]);

  /** Dipanggil per-frame saat phase liveness; selesaikan saat lulus. */
  const livenessRef = useRef<ReturnType<typeof createLivenessDetector> | null>(null);
  const runLiveness = useCallback(async (video: HTMLVideoElement) => {
    if (phase !== "liveness" || !who || !challenge || !outletStaff) return;
    if (!livenessRef.current) livenessRef.current = createLivenessDetector(challenge);
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const det = await faceapi.detectSingleFace(video, DETECT_OPTS).withFaceLandmarks();
      if (!det) return;
      const passed = livenessRef.current.feed(featuresFromLandmarks(det as any));
      if (passed) {
        livenessRef.current = null;
        await doSubmit(video);
      }
    } finally {
      busyRef.current = false;
    }
  }, [phase, who, challenge, outletStaff]);

  async function doSubmit(video: HTMLVideoElement) {
    if (!who || !outletStaff) return;
    setPhase("submitting");
    const { dataUrl } = captureFrame(video);
    const id = crypto.randomUUID();
    const payload: AttendancePayload = {
      id,
      outlet_staff_id: who.id,
      type: action,
      match_distance: 0,
      selfie_path: null,
      ts_client: new Date().toISOString(),
      from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      setResult({ ok: true, message: `Tersimpan offline — sinkron saat online` });
      setPhase("result"); scheduleReset(); return;
    }

    const path = `${outletStaff.outlet_id}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg" });
    const token = session?.access_token;
    if (!token) { setResult({ ok: false, message: "Sesi habis, login ulang" }); setPhase("result"); scheduleReset(); return; }

    const res = await submitAttendance({ ...payload, selfie_path: path }, { functionUrl: FUNCTION_URL, accessToken: token });
    setResult(res.ok
      ? { ok: true, message: `${action === "in" ? "Masuk" : "Keluar"} · ${res.status}` }
      : { ok: false, message: gagalText(res.reason) });
    setPhase("result");
    scheduleReset();
  }

  function scheduleReset() {
    setTimeout(() => {
      setPhase("idle"); setWho(null); setChallenge(null); setResult(null);
      livenessRef.current = null;
    }, 2500);
  }

  /** Flush antrian offline saat online (panggil dari page saat outletStaff siap & online). */
  const flushQueue = useCallback(() => {
    if (outletStaff && navigator.onLine) queue.flush(outletStaff.outlet_id);
  }, [outletStaff, queue]);

  return { phase, who, action, challenge, challengeLabel: challenge ? CHALLENGE_LABEL[challenge] : "", result,
           loadCandidates, tick, runLiveness, flushQueue, isOnline: queue.isOnline, pending: queue.pending };
}

function gagalText(reason: string): string {
  const map: Record<string, string> = {
    not_enrolled: "Belum enroll wajah",
    forbidden_role: "Akun tak berwenang absen",
    cross_outlet: "Staff beda outlet",
    unauthenticated: "Sesi habis, login ulang",
  };
  return map[reason] ?? `Gagal: ${reason}`;
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no error di `useClockKiosk.ts`. (`featuresFromLandmarks(det as any)` disengaja karena tipe face-api landmark kompleks.)

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/features/clock/useClockKiosk.ts && git commit -m "feat(absensi): hook kiosk absensi (identify 1:N + liveness + state IN/OUT)"
```

---

## Task 13: Clock page — UI kiosk

**Files:**
- Modify: `apps/absensi/src/app/clock/page.tsx` (ganti total)

- [ ] **Step 1: Ganti isi page**

Ganti SELURUH isi `apps/absensi/src/app/clock/page.tsx` dengan:
```tsx
"use client";

import { useEffect, useRef } from "react";
import { Card, Spinner } from "@suka/design-system";
import { UserRound, Eye, CircleCheck, CircleX } from "lucide-react";
import { CameraCapture } from "@/components/CameraCapture";
import { loadFaceModels } from "@/lib/face/recognizer";
import { useAuth } from "@/context/AuthContext";
import { useClockKiosk } from "@/features/clock/useClockKiosk";

export default function ClockPage() {
  const { outletStaff } = useAuth();
  const kiosk = useClockKiosk();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopRef = useRef<number | null>(null);

  useEffect(() => { loadFaceModels(); }, []);
  useEffect(() => { if (outletStaff) { kiosk.loadCandidates(); kiosk.flushQueue(); } }, [outletStaff]);

  // Loop deteksi: jalankan tick/liveness sesuai phase.
  useEffect(() => {
    function loop() {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        if (kiosk.phase === "idle") kiosk.tick(v);
        else if (kiosk.phase === "liveness") kiosk.runLiveness(v);
      }
      loopRef.current = window.setTimeout(loop, 350);
    }
    loop();
    return () => { if (loopRef.current) clearTimeout(loopRef.current); };
  }, [kiosk.phase, kiosk.tick, kiosk.runLiveness]);

  const ringColor =
    kiosk.phase === "idle" ? "border-gray-400 border-dashed" :
    kiosk.phase === "result" && !kiosk.result?.ok ? "border-red-500" : "border-suka-green";

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-suka-brown">Absensi</h1>
        {!kiosk.isOnline && (
          <span className="text-xs text-amber-600">Offline · {kiosk.pending} menunggu sync</span>
        )}
      </div>

      <Card className="relative overflow-hidden p-0">
        <div className="relative">
          <CameraCapture onReady={(v) => (videoRef.current = v)} />
          <div className={`pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-full border-4 ${ringColor}`} />
        </div>

        <div className="p-4 text-center min-h-[92px] flex flex-col items-center justify-center gap-2">
          {kiosk.phase === "idle" && (
            <p className="flex items-center gap-2 text-gray-500"><UserRound size={18} /> Menghadap kamera…</p>
          )}
          {kiosk.phase === "identified" && (
            <p className="text-lg font-medium text-suka-ink">Halo, {kiosk.who?.name}</p>
          )}
          {kiosk.phase === "liveness" && (
            <>
              <p className="text-sm text-gray-500">Halo, {kiosk.who?.name} · {kiosk.action === "in" ? "Clock-in" : "Clock-out"}</p>
              <p className="flex items-center gap-2 rounded-md border border-suka-orange bg-suka-cream px-3 py-2 font-medium text-suka-brown">
                <Eye size={18} /> {kiosk.challengeLabel}
              </p>
            </>
          )}
          {kiosk.phase === "submitting" && <Spinner />}
          {kiosk.phase === "result" && kiosk.result && (
            <p className={`flex items-center gap-2 text-lg font-medium ${kiosk.result.ok ? "text-suka-green" : "text-red-600"}`}>
              {kiosk.result.ok ? <CircleCheck size={22} /> : <CircleX size={22} />} {kiosk.result.message}
            </p>
          )}
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Hadapkan wajah ke kamera. Sistem mengenali otomatis lalu meminta satu gerakan acak.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no errors di seluruh app.

- [ ] **Step 3: Verifikasi E2E manual**

Jalankan `yarn workspace @suka/absensi dev`, buka `localhost:3000/clock`:
- Kamera muncul, ring putus-putus.
- Hadapkan wajah staff ter-enroll → muncul "Halo, <Nama>" → instruksi gerakan (kedip/toleh/angguk).
- Lakukan gerakan → ring hijau → "Masuk · tepat" + bunyi → reset.
- Foto diam HP rekan ter-enroll → gerakan acak tak terpenuhi → tak tercatat (anti-curang).

Expected: alur berjalan tanpa pilih nama & tanpa prompt GPS.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/clock/page.tsx && git commit -m "feat(absensi): layar clock jadi kiosk auto-identify + liveness (tanpa GPS)"
```

---

## Task 14: Dashboard — Papan Kehadiran

**Files:**
- Modify: `apps/absensi/src/app/dashboard/page.tsx` (ganti total)

- [ ] **Step 1: Ganti isi page**

Ganti SELURUH isi `apps/absensi/src/app/dashboard/page.tsx` dengan:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Avatar, StatusPill, EmptyState, Spinner } from "@suka/design-system";
import { LogIn, LogOut, Clock4, MoreHorizontal, Users } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { computeBoard, type BoardStaff, type BoardRecord, type BoardRow } from "@/features/board/board";

const PILL: Record<BoardRow["state"], { icon: React.ReactNode; label: (t: string | null) => string }> = {
  masuk:  { icon: <LogIn size={13} />,  label: (t) => `Masuk ${t}` },
  telat:  { icon: <Clock4 size={13} />, label: (t) => `Telat ${t}` },
  keluar: { icon: <LogOut size={13} />, label: (t) => `Keluar ${t}` },
  belum:  { icon: <MoreHorizontal size={13} />, label: () => "Belum hadir" },
};

export default function DashboardPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [data, setData] = useState<ReturnType<typeof computeBoard> | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: staff }, { data: recs }] = await Promise.all([
        supabase.from("outlet_staff").select("id,name,role").eq("outlet_id", outletStaff.outlet_id).eq("status", "active"),
        supabase.from("attendance").select("outlet_staff_id,type,status,ts_server")
          .eq("outlet_id", outletStaff.outlet_id).gte("ts_server", `${today}T00:00:00`).lte("ts_server", `${today}T23:59:59`),
      ]);
      setData(computeBoard((staff as BoardStaff[]) ?? [], (recs as BoardRecord[]) ?? []));
    })();
  }, [outletStaff]);

  if (!data) return <div className="p-6 flex justify-center"><Spinner /></div>;

  const cards = [
    { label: "Hadir", value: data.summary.hadir, color: "text-suka-green" },
    { label: "Telat", value: data.summary.telat, color: "text-[#854f0b]" },
    { label: "Belum hadir", value: data.summary.belum, color: "text-red-600" },
    { label: "Total staff", value: data.summary.total, color: "text-suka-ink" },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-suka-brown">Papan kehadiran</h1>
        <span className="text-sm text-gray-500">{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {data.rows.length === 0 && <EmptyState icon={<Users size={28} />} title="Belum ada staff aktif" />}
        {data.rows.map((r) => {
          const p = PILL[r.state];
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={r.name} size={34} />
              <div className="flex-1">
                <div className="text-sm font-medium text-suka-ink">{r.name}</div>
                <div className="text-xs text-gray-500 capitalize">{r.role}</div>
              </div>
              <StatusPill kind={r.state}>{p.icon}{p.label(r.time)}</StatusPill>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no errors.

- [ ] **Step 3: Cek manual**

Buka `localhost:3000/dashboard`: 4 metric card + daftar staff dengan StatusPill & Avatar. Tak ada emoji.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/dashboard/page.tsx && git commit -m "feat(absensi): dashboard jadi Papan Kehadiran Hari Ini"
```

---

## Task 15: Rekap — ringkasan + selfie + export

**Files:**
- Modify: `apps/absensi/src/app/rekap/page.tsx` (ganti total)

- [ ] **Step 1: Ganti isi page**

Ganti SELURUH isi `apps/absensi/src/app/rekap/page.tsx` dengan:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, StatusPill, EmptyState } from "@suka/design-system";
import { Download, LogIn, LogOut, CalendarDays, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { attendanceToCsv, downloadCsv, type CsvRow } from "@/features/rekap/csv";

type Row = {
  id: string;
  type: "in" | "out";
  ts_server: string;
  ts_client: string | null;
  status: "tepat" | "telat" | "alpha";
  selfie_url: string | null;
  outlet_staff: { name: string } | null;
};

const SELFIE_BUCKET = "selfies";

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!outletStaff) return;
    supabase
      .from("attendance")
      .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff(name)")
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", `${date}T00:00:00`)
      .lte("ts_server", `${date}T23:59:59`)
      .order("ts_server", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [outletStaff, date]);

  const summary = useMemo(() => ({
    tepat: rows.filter((r) => r.status === "tepat").length,
    telat: rows.filter((r) => r.status === "telat").length,
    alpha: rows.filter((r) => r.status === "alpha").length,
  }), [rows]);

  function jam(ts: string) {
    return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function selfieUrl(path: string) {
    return supabase.storage.from(SELFIE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function exportCsv() {
    const data: CsvRow[] = rows.map((r) => ({
      name: r.outlet_staff?.name ?? "-", type: r.type, jam: jam(r.ts_server), status: r.status,
    }));
    downloadCsv(`rekap-${date}.csv`, attendanceToCsv(data));
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-suka-brown">Rekap kehadiran</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-suka-gray-300 px-2 py-1.5 text-sm text-gray-600">
            <CalendarDays size={15} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="outline-none" />
          </label>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-md bg-suka-brown px-3 py-1.5 text-sm font-medium text-white">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([["Tepat", summary.tepat, "text-suka-green"], ["Telat", summary.telat, "text-[#854f0b]"], ["Alpha", summary.alpha, "text-red-600"]] as const).map(([label, val, color]) => (
          <div key={label} className="rounded-lg bg-suka-gray-50 p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-suka-gray-200 bg-white divide-y divide-suka-gray-200">
        {rows.length === 0 && <EmptyState icon={<ClipboardList size={28} />} title="Belum ada data" description="Tidak ada absensi untuk tanggal ini." />}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            {r.selfie_url ? (
              <img src={selfieUrl(r.selfie_url)} alt="selfie" onClick={() => setPreview(selfieUrl(r.selfie_url!))}
                   className="h-10 w-10 cursor-pointer rounded-md object-cover" />
            ) : <Avatar name={r.outlet_staff?.name ?? "?"} size={40} />}
            <div className="flex-1">
              <div className="text-sm font-medium text-suka-ink">{r.outlet_staff?.name ?? "-"}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {r.type === "in" ? <LogIn size={13} /> : <LogOut size={13} />}
                {r.type === "in" ? "Masuk" : "Keluar"} · {jam(r.ts_server)}
              </div>
            </div>
            <StatusPill kind={r.status}>{r.status}</StatusPill>
          </div>
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6">
          <img src={preview} alt="selfie besar" className="max-h-[80vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no errors.

- [ ] **Step 3: Cek manual**

Buka `localhost:3000/rekap`: ringkasan 3 kartu, baris dengan thumbnail selfie (klik → preview besar), tombol Export CSV mengunduh `rekap-<tanggal>.csv` yang terbuka rapi di spreadsheet.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/app/rekap/page.tsx && git commit -m "feat(absensi): rekap + ringkasan + spot-check selfie + export CSV"
```

---

## Task 16: Enroll — poles ikon

**Files:**
- Modify: `apps/absensi/src/app/enroll/page.tsx`

Pertahankan logika enroll (consent, 3 foto, save). Hanya rapikan: ikon lucide, judul brand, pesan via teks (tanpa emoji).

- [ ] **Step 1: Tambah import ikon & pakai toast**

Di `apps/absensi/src/app/enroll/page.tsx`, tambah import:
```tsx
import { Camera, Save, ShieldCheck } from "lucide-react";
import { useToast } from "@/lib/feedback/toast";
```
Di dalam komponen, tambah setelah `const supabase = createClient();`:
```tsx
  const toast = useToast();
```

- [ ] **Step 2: Ganti judul & label ikon**

GANTI:
```tsx
      <h1 className="text-xl font-bold">Enroll Wajah Staff</h1>
```
MENJADI:
```tsx
      <h1 className="flex items-center gap-2 text-xl font-bold text-suka-brown"><Camera size={20} /> Enroll wajah staff</h1>
```
GANTI label consent:
```tsx
        Staff menyetujui pemrosesan data biometrik (UU PDP).
```
MENJADI:
```tsx
        <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-suka-green" /> Staff menyetujui pemrosesan data biometrik (UU PDP).</span>
```
GANTI tombol simpan:
```tsx
            <Button onClick={save} disabled={shots.length === 0}>
              Simpan
            </Button>
```
MENJADI:
```tsx
            <Button onClick={save} disabled={shots.length === 0}>
              <span className="flex items-center gap-1.5"><Save size={16} /> Simpan</span>
            </Button>
```

- [ ] **Step 3: Ganti pesan sukses/gagal emoji jadi toast**

Di fungsi `save`, GANTI:
```tsx
    setMsg(error ? `❌ ${error.message}` : "✅ Enroll tersimpan.");
    setShots([]);
```
MENJADI:
```tsx
    if (error) toast.show("err", error.message);
    else toast.show("ok", "Enroll tersimpan");
    setShots([]);
```
Dan di `takeShot`, GANTI:
```tsx
    if (!d) return setMsg("Wajah tidak terdeteksi.");
```
MENJADI:
```tsx
    if (!d) return toast.show("err", "Wajah tidak terdeteksi");
```

- [ ] **Step 4: Type-check**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check
```
Expected: no errors. (Variabel `msg`/`setMsg` boleh tetap dipakai untuk pesan progres foto; emoji sudah hilang.)

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/app/enroll/page.tsx && git commit -m "refactor(absensi): poles enroll dengan ikon + toast (hapus emoji)"
```

---

## Task 17: Verifikasi akhir — full test + build

**Files:** (tidak ada — verifikasi)

- [ ] **Step 1: Seluruh unit test**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi test
```
Expected: semua PASS (identify, liveness, board, csv, + test M1 lama: face/match, image, attendance/submit). Catatan: `gps.test.ts` lama masih lulus (haversine util tetap ada).

- [ ] **Step 2: Type-check penuh**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi type-check && yarn workspace @suka/design-system type-check
```
Expected: no errors di kedua paket.

- [ ] **Step 3: Build produksi (static export)**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT && yarn workspace @suka/absensi build
```
Expected: build sukses, `out/` tergenerate, tanpa error "Module not found".

- [ ] **Step 4: Grep sisa emoji**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/apps/absensi && grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/ || echo "BERSIH: tak ada emoji"
```
Expected: `BERSIH: tak ada emoji` (atau hanya di komentar/test yang tak tampil ke user).

- [ ] **Step 5: Cek tak ada referensi GPS di alur absen**

Run:
```bash
cd /c/Users/AK/Desktop/Project/DIGITALISASI-SS-PROJECT/apps/absensi && grep -rn "getCurrentPosition\|gps_lat\|outside_radius" src/app src/features || echo "BERSIH: GPS lepas dari alur"
```
Expected: `BERSIH: GPS lepas dari alur`.

- [ ] **Step 6: Commit catatan selesai (opsional)**

Bila ada perubahan tersisa:
```bash
git add -A && git commit -m "chore(absensi): verifikasi akhir redesain UI kiosk lulus"
```

---

## Catatan implementasi
- **TDD** hanya untuk logika murni (identify, liveness, board, csv). UI/glue (kiosk hook, pages) diverifikasi via `type-check` + build + E2E manual — sesuai sifat static-export client-side.
- **Anti-curang** = face 1:N + liveness acak dua-fase + selfie audit. GPS sudah dibuang penuh.
- **Skalabilitas**: folder `features/*` + unit murni terpisah jadi titik integrasi sistem lain; export CSV = kontrak data pertama.
- **Performa**: tanpa tunggu GPS; liveness pakai model landmark yang sudah dimuat; ikon tree-shaken; descriptor di-cache lewat query sekali per sesi kiosk.
