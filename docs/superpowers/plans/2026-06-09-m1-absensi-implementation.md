# M1 Absensi + Face Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun M1 (absensi outlet anti titip-absen) di atas fondasi M0: clock-in/out dengan face match 1:1 + GPS radius + selfie audit, enroll wajah oleh SPV, rekap kehadiran, consent + retensi selfie.

**Architecture:** App Next.js (`apps/absensi`) di monorepo yarn workspaces. Face match 1:1 dilakukan client-side (face-api.js). Keputusan absen sah/tidak (radius GPS), timestamp server, dan status (tepat/telat) difinalkan **Edge Function `submit-attendance`** (service role, idempoten via UUID client). Offline pakai `@suka/offline-queue` (localStorage). UI pakai `@suka/design-system`. Auth mengikuti M0: device login sekali sebagai akun SPV/kepala_outlet; daftar staff dibaca via RLS SPV; absen dicatat untuk staff terpilih oleh Edge Function.

**Tech Stack:** Next.js 16 + React 19, TypeScript, Tailwind 4, `@supabase/ssr` + `@supabase/supabase-js`, face-api.js, Vitest, Supabase (Postgres + RLS + Storage + Edge Functions Deno + pg_cron).

---

## Kontrak M0 yang dipakai (sudah ada di `main`)

- `outlets(id uuid PK, slug, name, address, lat NOT NULL, lng NOT NULL, type, is_active, ...)` — RLS: authenticated boleh SELECT semua; insert/update/delete denied.
- `outlet_staff(id uuid PK = auth.uid(), outlet_id FK, name, role(crew|kasir|spv|kepala_outlet), face_descriptor jsonb, ref_photo_url, status(active|inactive|on_leave), created_at, updated_at, UNIQUE(outlet_id,name))` — RLS: staff baca diri sendiri; SPV/kepala_outlet baca+update staff se-outlet; service_role insert/update.
- **Tidak ada custom claim `outlet_id` di JWT.** `outlet_id` diturunkan via lookup `outlet_staff WHERE id = auth.uid()`.
- `packages/design-system` → `@suka/design-system`: `Button`, `Card`, `Input`, `Badge`, `tokens`, `cn`.
- `packages/offline-queue` → `@suka/offline-queue`: `useOfflineQueue<T>(storageKey, opts)` → `{ items, isOnline, isPending, add(data)→id, flush(submitFn) }`; `QueueStorage<T>` (localStorage).
- App shell M0 di `apps/absensi/src/`: `lib/supabase.ts` (`createClient`, `createServerSupabaseClient`), `env.ts`, `context/AuthContext.tsx` (`useAuth()` → `{ session, outletStaff, loading, signOut }`), `app/layout.tsx`, `app/page.tsx` (redirect `/dashboard`).
- Edge Function contoh: `supabase/functions/sync-outlets/` (struktur Deno + `deno.json`).

## File Structure (yang dibuat/diubah M1)

**Database & Edge Functions (`supabase/`)**
- Create `supabase/migrations/20260610000000_m1_outlet_staff_enroll.sql` — tambah kolom enroll ke `outlet_staff`.
- Create `supabase/migrations/20260610000100_m1_attendance.sql` — tabel `attendance` + index.
- Create `supabase/migrations/20260610000200_m1_outlet_attendance_config.sql` — tabel config jam kerja/radius + seed default.
- Create `supabase/migrations/20260610000300_m1_attendance_rls.sql` — RLS `attendance` + `outlet_attendance_config`.
- Create `supabase/migrations/20260610000400_m1_storage_buckets.sql` — bucket `selfies`, `face-refs` + policy + cron retensi.
- Create `supabase/functions/submit-attendance/index.ts` + `deno.json` — jalur tulis absen.
- Create `supabase/functions/submit-attendance/index.test.ts` — unit test logika murni.
- Create `supabase/functions/_shared/haversine.ts` — jarak GPS server-side (dipakai Edge Function).
- Create `supabase/functions/mark-alpha/index.ts` + `deno.json` — job harian tandai alpha (pg_cron).
- Create `supabase/migrations/20260610000500_m1_cron_mark_alpha.sql` — jadwal pg_cron mark-alpha.

**App (`apps/absensi/`)**
- Modify `apps/absensi/package.json` — tambah `face-api.js`, devDeps `vitest` + `fake-indexeddb` + `@vitest/...`, script `test`.
- Create `apps/absensi/vitest.config.ts`.
- Create `apps/absensi/src/lib/gps.ts` (+ `gps.test.ts`) — pindahan dari scaffold sementara.
- Create `apps/absensi/src/lib/face/match.ts` (+ `match.test.ts`) — pindahan.
- Create `apps/absensi/src/lib/face/recognizer.ts` — wrapper face-api.js (load model + descriptor).
- Create `apps/absensi/src/lib/attendance/types.ts` — `AttendancePayload`, `SubmitResult`.
- Create `apps/absensi/src/lib/attendance/submit.ts` (+ `submit.test.ts`) — panggil Edge Function.
- Create `apps/absensi/src/lib/attendance/useAttendanceQueue.ts` — bungkus `useOfflineQueue` + replay.
- Create `apps/absensi/src/lib/image.ts` (+ `image.test.ts`) — kompres dataURL selfie.
- Create `apps/absensi/src/app/clock/page.tsx` — layar crew clock-in/out.
- Create `apps/absensi/src/app/enroll/page.tsx` — layar SPV enroll.
- Create `apps/absensi/src/app/rekap/page.tsx` — layar SPV rekap.
- Create `apps/absensi/src/components/CameraCapture.tsx` — komponen kamera reusable.
- Create `apps/absensi/public/models/.gitkeep` — tempat model face-api.js (diunduh saat setup).

---

## Task 1: Integrasikan branch M1 dengan fondasi M0

Branch `feat/m1-absensi` saat ini berisi scaffold npm sementara (`apps/absensi/lib/`, `package.json`, `tsconfig.json`, `vitest.config.ts`) yang bentrok dengan struktur M0 (`src/`-based, yarn workspaces). Buang scaffold sementara, adopsi struktur M0, simpan hanya kode utilitas murni (`gps`, `face/match`) untuk dipindah di Task 4.

**Files:**
- Modify: branch state (merge `origin/main`)
- Delete: `apps/absensi/lib/queue/attendance-queue.ts` + test (diganti `@suka/offline-queue`)
- Preserve sementara: `apps/absensi/lib/gps.ts` + test, `apps/absensi/lib/face/match.ts` + test

- [ ] **Step 1: Simpan salinan utilitas murni ke lokasi aman sementara**

```bash
cd apps/absensi
mkdir -p ../../_m1_keep/face
cp lib/gps.ts lib/gps.test.ts ../../_m1_keep/
cp lib/face/match.ts lib/face/match.test.ts ../../_m1_keep/face/
cd ../..
```

- [ ] **Step 2: Reset branch ke fondasi M0, pertahankan commit dokumentasi spec**

Pakai merge agar histori M0 ikut, lalu buang scaffold sementara:

```bash
git checkout feat/m1-absensi
git merge origin/main -m "merge: fondasi M0 ke branch M1"
```

Saat konflik `add/add` pada `apps/absensi/package.json` & `apps/absensi/tsconfig.json`, ambil versi M0:

```bash
git checkout --theirs apps/absensi/package.json apps/absensi/tsconfig.json
git add apps/absensi/package.json apps/absensi/tsconfig.json
```

- [ ] **Step 3: Hapus scaffold sementara yang sudah digantikan M0**

```bash
git rm -r apps/absensi/lib apps/absensi/vitest.config.ts apps/absensi/package-lock.json
git commit -m "chore(m1): adopsi struktur M0, buang scaffold npm sementara"
```

- [ ] **Step 4: Verifikasi struktur M0 utuh**

Run: `git show HEAD:apps/absensi/src/lib/supabase.ts | head -5`
Expected: tampil isi `lib/supabase.ts` dari M0 (bukan error).

Run: `ls apps/absensi/src`
Expected: ada `app/`, `components/`, `context/`, `env.ts`, `lib/`.

- [ ] **Step 5: Install dependencies (yarn workspaces)**

Run: `yarn install`
Expected: selesai tanpa error; `node_modules` terpasang di root.

---

## Task 2: Tooling test di apps/absensi (Vitest)

M0 belum menambah test runner. Tambahkan Vitest agar utilitas M1 bisa TDD.

**Files:**
- Modify: `apps/absensi/package.json`
- Create: `apps/absensi/vitest.config.ts`

- [ ] **Step 1: Tambah devDeps + script test ke `apps/absensi/package.json`**

Tambahkan ke bagian `devDependencies` dan `scripts` (pertahankan field M0 lain):

```jsonc
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "face-api.js": "^0.22.2"
    // ...dependency M0 lain tetap
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "fake-indexeddb": "^6.0.0",
    "jsdom": "^25.0.0"
    // ...devDependency M0 lain tetap
  }
}
```

- [ ] **Step 2: Buat `apps/absensi/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Install**

Run: `yarn install`
Expected: vitest + face-api.js terpasang.

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/package.json apps/absensi/vitest.config.ts
git commit -m "chore(m1): tambah Vitest + face-api.js ke apps/absensi"
```

---

## Task 3: Migration — kolom enroll di outlet_staff

Tambah kolom consent & enrollment (additive) ke tabel inti `outlet_staff`. Aman: tidak mengubah kolom existing.

**Files:**
- Create: `supabase/migrations/20260610000000_m1_outlet_staff_enroll.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- M1: kolom consent & enrollment wajah (additive, UU PDP)
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS consent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_by  UUID REFERENCES outlet_staff(id),
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;

COMMENT ON COLUMN outlet_staff.consent_at IS 'Waktu staff menyetujui pemrosesan data biometrik';
COMMENT ON COLUMN outlet_staff.consent_by IS 'SPV/kepala_outlet yang melakukan enroll';
COMMENT ON COLUMN outlet_staff.enrolled_at IS 'Waktu descriptor wajah tersimpan';

-- DOWN:
-- ALTER TABLE outlet_staff
--   DROP COLUMN IF EXISTS consent_at,
--   DROP COLUMN IF EXISTS consent_by,
--   DROP COLUMN IF EXISTS enrolled_at;
```

- [ ] **Step 2: Verifikasi SQL valid (lokal, jika Supabase CLI tersedia)**

Run: `npx supabase db reset --linked` (atau review manual jika belum link)
Expected: migration jalan tanpa error; kolom muncul di `outlet_staff`.
Jika belum ada koneksi DB lokal, verifikasi minimal: file ada & sintaks SQL benar (review).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610000000_m1_outlet_staff_enroll.sql
git commit -m "feat(m1): migration kolom enroll wajah di outlet_staff"
```

---

## Task 4: Migration — tabel attendance

**Files:**
- Create: `supabase/migrations/20260610000100_m1_attendance.sql`

- [ ] **Step 1: Tulis migration**

```sql
-- M1: catatan absensi (clock-in/out)
CREATE TABLE attendance (
  id              UUID PRIMARY KEY,                 -- digenerate client (idempotency)
  outlet_staff_id UUID NOT NULL REFERENCES outlet_staff(id) ON DELETE CASCADE,
  outlet_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('in','out')),
  ts_server       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ts_client       TIMESTAMPTZ,
  gps_lat         NUMERIC,
  gps_lng         NUMERIC,
  distance_m      NUMERIC,
  match_distance  NUMERIC,
  selfie_url      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('tepat','telat','alpha')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_outlet_date ON attendance(outlet_id, ts_server);
CREATE INDEX idx_attendance_staff_date  ON attendance(outlet_staff_id, ts_server);

COMMENT ON COLUMN attendance.id IS 'UUID dari client; idempotency key untuk replay offline';
COMMENT ON COLUMN attendance.ts_client IS 'Waktu device saat absen; basis status telat bila absen offline';

-- DOWN:
-- DROP TABLE IF EXISTS attendance;
```

- [ ] **Step 2: Verifikasi**

Run: review SQL / `npx supabase db reset --linked` jika tersedia.
Expected: tabel `attendance` ada dengan constraint type & status.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610000100_m1_attendance.sql
git commit -m "feat(m1): migration tabel attendance"
```

---

## Task 5: Migration — outlet_attendance_config + seed

Config jam kerja & radius per outlet (terpisah dari `outlets` yang read-only).

**Files:**
- Create: `supabase/migrations/20260610000200_m1_outlet_attendance_config.sql`

- [ ] **Step 1: Tulis migration + seed default untuk semua outlet**

```sql
-- M1: config jam kerja & radius GPS per outlet
CREATE TABLE outlet_attendance_config (
  outlet_id       UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,
  jam_masuk       TIME NOT NULL DEFAULT '09:00',
  toleransi_menit INT  NOT NULL DEFAULT 15,
  radius_m        INT  NOT NULL DEFAULT 100,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default untuk setiap outlet yang sudah ada
INSERT INTO outlet_attendance_config (outlet_id)
SELECT id FROM outlets
ON CONFLICT (outlet_id) DO NOTHING;

-- DOWN:
-- DROP TABLE IF EXISTS outlet_attendance_config;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260610000200_m1_outlet_attendance_config.sql
git commit -m "feat(m1): migration outlet_attendance_config + seed default"
```

---

## Task 6: Migration — RLS attendance & config

Ikuti pola M0 (EXISTS subquery via `auth.uid()`), bukan JWT claim.

**Files:**
- Create: `supabase/migrations/20260610000300_m1_attendance_rls.sql`

- [ ] **Step 1: Tulis RLS**

```sql
-- attendance RLS: isolasi per-outlet
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Staff/ SPV boleh baca attendance di outlet-nya sendiri
CREATE POLICY attendance_read_own_outlet
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = attendance.outlet_id
    )
  );

-- Tulis attendance HANYA via Edge Function (service role). Client tidak insert langsung.
CREATE POLICY attendance_service_insert
  ON attendance FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY attendance_service_update
  ON attendance FOR UPDATE
  TO service_role
  USING (true);

-- outlet_attendance_config RLS
ALTER TABLE outlet_attendance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY oac_read_own_outlet
  ON outlet_attendance_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
    )
  );

CREATE POLICY oac_update_spv
  ON outlet_attendance_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND me.outlet_id = outlet_attendance_config.outlet_id
        AND me.role IN ('spv','kepala_outlet')
    )
  );

-- DOWN:
-- DROP POLICY IF EXISTS attendance_read_own_outlet ON attendance;
-- DROP POLICY IF EXISTS attendance_service_insert ON attendance;
-- DROP POLICY IF EXISTS attendance_service_update ON attendance;
-- DROP POLICY IF EXISTS oac_read_own_outlet ON outlet_attendance_config;
-- DROP POLICY IF EXISTS oac_update_spv ON outlet_attendance_config;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260610000300_m1_attendance_rls.sql
git commit -m "feat(m1): RLS attendance + outlet_attendance_config (pola M0)"
```

---

## Task 7: Migration — Storage buckets + retensi selfie

**Files:**
- Create: `supabase/migrations/20260610000400_m1_storage_buckets.sql`

- [ ] **Step 1: Tulis migration bucket + retensi**

```sql
-- M1: bucket selfie audit & foto referensi enroll
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies', 'selfies', false), ('face-refs', 'face-refs', false)
ON CONFLICT (id) DO NOTHING;

-- Baca selfie/face-ref hanya untuk staff di outlet yang sama (path: <outlet_id>/...)
CREATE POLICY selfies_read_own_outlet
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('selfies','face-refs')
    AND EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND (storage.foldername(name))[1] = me.outlet_id::text
    )
  );

-- Upload selfie/face-ref hanya ke folder outlet sendiri
CREATE POLICY selfies_write_own_outlet
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('selfies','face-refs')
    AND EXISTS (
      SELECT 1 FROM outlet_staff me
      WHERE me.id = auth.uid()
        AND (storage.foldername(name))[1] = me.outlet_id::text
    )
  );

-- Retensi 90 hari: hapus selfie lama via pg_cron harian 02:00
SELECT cron.schedule(
  'cleanup-selfies',
  '0 2 * * *',
  $$
    DELETE FROM storage.objects
    WHERE bucket_id = 'selfies'
      AND created_at < NOW() - INTERVAL '90 days';
    UPDATE attendance SET selfie_url = NULL
      WHERE selfie_url IS NOT NULL
        AND ts_server < NOW() - INTERVAL '90 days';
  $$
);

-- DOWN:
-- SELECT cron.unschedule('cleanup-selfies');
-- DROP POLICY IF EXISTS selfies_read_own_outlet ON storage.objects;
-- DROP POLICY IF EXISTS selfies_write_own_outlet ON storage.objects;
-- DELETE FROM storage.buckets WHERE id IN ('selfies','face-refs');
```

> Catatan: `pg_cron` harus di-enable di project (`CREATE EXTENSION IF NOT EXISTS pg_cron;`). Jika M0 belum enable, tambahkan baris itu di awal migration.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260610000400_m1_storage_buckets.sql
git commit -m "feat(m1): storage buckets selfie/face-refs + retensi 90 hari (pg_cron)"
```

---

## Task 8: Pindahkan utilitas murni gps + face/match ke src/lib (TDD tetap hijau)

Kode + test sudah ada (disimpan di `_m1_keep/` pada Task 1). Pindahkan ke struktur M0 `src/lib/`.

**Files:**
- Create: `apps/absensi/src/lib/gps.ts`, `apps/absensi/src/lib/gps.test.ts`
- Create: `apps/absensi/src/lib/face/match.ts`, `apps/absensi/src/lib/face/match.test.ts`

- [ ] **Step 1: Pindahkan file dari simpanan sementara**

```bash
mkdir -p apps/absensi/src/lib/face
cp _m1_keep/gps.ts apps/absensi/src/lib/gps.ts
cp _m1_keep/gps.test.ts apps/absensi/src/lib/gps.test.ts
cp _m1_keep/face/match.ts apps/absensi/src/lib/face/match.ts
cp _m1_keep/face/match.test.ts apps/absensi/src/lib/face/match.test.ts
rm -rf _m1_keep
```

Isi `gps.ts` dan `match.ts` sama persis seperti yang sudah lulus test sebelumnya (haversineMeters, isWithinRadius; euclideanDistance, isMatch, averageDescriptors, DEFAULT_MATCH_THRESHOLD=0.5).

- [ ] **Step 2: Jalankan test untuk verifikasi hijau di lokasi baru**

Run: `cd apps/absensi && yarn test`
Expected: PASS — `src/lib/gps.test.ts` (7) + `src/lib/face/match.test.ts` (12).

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/lib/gps.ts apps/absensi/src/lib/gps.test.ts apps/absensi/src/lib/face/match.ts apps/absensi/src/lib/face/match.test.ts
git commit -m "refactor(m1): pindah utilitas gps + face/match ke src/lib"
```

---

## Task 9: Shared haversine untuk Edge Function (Deno)

Edge Function tak bisa import dari `apps/`. Buat versi shared di `supabase/functions/_shared`.

**Files:**
- Create: `supabase/functions/_shared/haversine.ts`
- Create: `supabase/functions/_shared/haversine.test.ts`

- [ ] **Step 1: Tulis test (Deno)**

```typescript
import { assertEquals } from "jsr:@std/assert";
import { haversineMeters } from "./haversine.ts";

Deno.test("identical points → 0", () => {
  assertEquals(haversineMeters({ lat: -6.2, lng: 106.84 }, { lat: -6.2, lng: 106.84 }), 0);
});

Deno.test("1 degree latitude ≈ 111 km", () => {
  const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  if (d < 111000 || d > 111400) throw new Error(`unexpected: ${d}`);
});
```

- [ ] **Step 2: Verifikasi gagal**

Run: `cd supabase/functions && deno test _shared/haversine.test.ts`
Expected: FAIL — module `haversine.ts` belum ada.

- [ ] **Step 3: Tulis implementasi**

```typescript
export type LatLng = { lat: number; lng: number };
const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

- [ ] **Step 4: Verifikasi lulus**

Run: `deno test _shared/haversine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/haversine.ts supabase/functions/_shared/haversine.test.ts
git commit -m "feat(m1): shared haversine untuk Edge Function"
```

---

## Task 10: Logika status absensi (murni, TDD) untuk Edge Function

Pisahkan keputusan status agar bisa diuji tanpa HTTP/DB.

**Files:**
- Create: `supabase/functions/submit-attendance/status.ts`
- Create: `supabase/functions/submit-attendance/status.test.ts`

- [ ] **Step 1: Tulis test**

```typescript
import { assertEquals } from "jsr:@std/assert";
import { computeStatus } from "./status.ts";

const cfg = { jam_masuk: "09:00", toleransi_menit: 15 };

Deno.test("clock-out selalu 'tepat' (tak dihitung telat)", () => {
  assertEquals(computeStatus("out", "2026-06-09T10:00:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("masuk sebelum jam_masuk+toleransi → tepat", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:10:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});

Deno.test("masuk setelah jam_masuk+toleransi → telat", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:30:00+07:00", cfg, "Asia/Jakarta"), "telat");
});

Deno.test("tepat di batas toleransi → tepat (inklusif)", () => {
  assertEquals(computeStatus("in", "2026-06-09T09:15:00+07:00", cfg, "Asia/Jakarta"), "tepat");
});
```

- [ ] **Step 2: Verifikasi gagal**

Run: `cd supabase/functions && deno test submit-attendance/status.test.ts`
Expected: FAIL — `status.ts` belum ada.

- [ ] **Step 3: Tulis implementasi**

```typescript
export type AttendanceConfig = { jam_masuk: string; toleransi_menit: number };
export type AttendanceStatus = "tepat" | "telat" | "alpha";

/** Menentukan status absen masuk. Clock-out selalu 'tepat'. */
export function computeStatus(
  type: "in" | "out",
  tsBasis: string,        // ISO timestamp (ts_server online; ts_client bila dari queue)
  cfg: AttendanceConfig,
  tz = "Asia/Jakarta",
): AttendanceStatus {
  if (type === "out") return "tepat";

  // Jam lokal outlet dari timestamp
  const local = new Date(
    new Date(tsBasis).toLocaleString("en-US", { timeZone: tz }),
  );
  const [h, m] = cfg.jam_masuk.split(":").map(Number);
  const deadline = new Date(local);
  deadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

  return local.getTime() <= deadline.getTime() ? "tepat" : "telat";
}
```

- [ ] **Step 4: Verifikasi lulus**

Run: `deno test submit-attendance/status.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-attendance/status.ts supabase/functions/submit-attendance/status.test.ts
git commit -m "feat(m1): logika status absensi (tepat/telat) untuk Edge Function"
```

---

## Task 11: Edge Function submit-attendance (handler)

Validasi auth caller, lokasi (radius), timestamp server, status, insert idempoten.

**Files:**
- Create: `supabase/functions/submit-attendance/deno.json`
- Create: `supabase/functions/submit-attendance/index.ts`

- [ ] **Step 1: Buat `deno.json` (mirror sync-outlets)**

```json
{
  "imports": {
    "@supabase/supabase-js": "jsr:@supabase/supabase-js@2"
  }
}
```

- [ ] **Step 2: Tulis handler `index.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { haversineMeters } from "../_shared/haversine.ts";
import { computeStatus } from "./status.ts";

type Body = {
  id: string;
  outlet_staff_id: string;
  type: "in" | "out";
  gps_lat: number;
  gps_lng: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, reason: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client beridentitas caller (untuk auth.getUser); + admin client (service role) untuk tulis.
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, serviceKey);

  const { data: userData } = await userClient.auth.getUser();
  const callerId = userData.user?.id;
  if (!callerId) return json(401, { ok: false, reason: "unauthenticated" });

  let body: Body;
  try { body = await req.json(); } catch { return json(400, { ok: false, reason: "bad_json" }); }

  // Caller harus SPV/kepala_outlet (device login); ambil outlet_id caller.
  const { data: caller } = await admin
    .from("outlet_staff")
    .select("outlet_id, role")
    .eq("id", callerId).single();
  if (!caller) return json(403, { ok: false, reason: "caller_not_staff" });

  // Target staff harus se-outlet dengan caller & sudah enroll.
  const { data: target } = await admin
    .from("outlet_staff")
    .select("outlet_id, face_descriptor")
    .eq("id", body.outlet_staff_id).single();
  if (!target) return json(404, { ok: false, reason: "staff_not_found" });
  if (target.outlet_id !== caller.outlet_id) return json(403, { ok: false, reason: "cross_outlet" });
  if (!target.face_descriptor) return json(422, { ok: false, reason: "not_enrolled" });

  // Validasi path selfie milik outlet ini.
  if (body.selfie_path && !body.selfie_path.startsWith(`${caller.outlet_id}/`)) {
    return json(403, { ok: false, reason: "selfie_path_mismatch" });
  }

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

  const tsServer = new Date().toISOString();
  const basis = body.from_queue ? body.ts_client : tsServer;
  const status = computeStatus(body.type, basis, cfg);

  // Insert idempoten (ON CONFLICT via upsert ignoreDuplicates).
  const { error } = await admin.from("attendance").upsert({
    id: body.id,
    outlet_staff_id: body.outlet_staff_id,
    outlet_id: caller.outlet_id,
    type: body.type,
    ts_server: tsServer,
    ts_client: body.ts_client,
    gps_lat: body.gps_lat,
    gps_lng: body.gps_lng,
    distance_m: distance,
    match_distance: body.match_distance,
    selfie_url: body.selfie_path,
    status,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return json(500, { ok: false, reason: "insert_failed", detail: error.message });

  return json(200, { ok: true, status, distance_m: distance, ts_server: tsServer, attendance_id: body.id });
});
```

- [ ] **Step 3: Type-check (Deno)**

Run: `cd supabase/functions && deno check submit-attendance/index.ts`
Expected: tidak ada error type.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/submit-attendance/deno.json supabase/functions/submit-attendance/index.ts
git commit -m "feat(m1): Edge Function submit-attendance (validasi radius, ts_server, status, idempoten)"
```

---

## Task 12: Kompres selfie (murni, TDD)

Selfie offline disimpan sebagai dataURL kecil di queue (localStorage). Sediakan util kompres + util validasi ukuran.

**Files:**
- Create: `apps/absensi/src/lib/image.ts`
- Create: `apps/absensi/src/lib/image.test.ts`

- [ ] **Step 1: Tulis test (fungsi murni `estimateDataUrlBytes`)**

```typescript
import { describe, expect, test } from "vitest";
import { estimateDataUrlBytes, isWithinSizeLimit } from "./image";

describe("estimateDataUrlBytes", () => {
  test("menghitung byte dari panjang base64", () => {
    // "data:image/jpeg;base64,AAAA" → 4 base64 chars = 3 bytes
    expect(estimateDataUrlBytes("data:image/jpeg;base64,AAAA")).toBe(3);
  });
});

describe("isWithinSizeLimit", () => {
  test("true bila di bawah limit", () => {
    expect(isWithinSizeLimit("data:image/jpeg;base64,AAAA", 1000)).toBe(true);
  });
  test("false bila melebihi limit", () => {
    const big = "data:image/jpeg;base64," + "A".repeat(2000);
    expect(isWithinSizeLimit(big, 1000)).toBe(false);
  });
});
```

- [ ] **Step 2: Verifikasi gagal**

Run: `cd apps/absensi && yarn test image`
Expected: FAIL — `image.ts` belum ada.

- [ ] **Step 3: Tulis implementasi**

```typescript
/** Perkiraan ukuran byte dari sebuah dataURL base64. */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function isWithinSizeLimit(dataUrl: string, maxBytes: number): boolean {
  return estimateDataUrlBytes(dataUrl) <= maxBytes;
}

/**
 * Kompres gambar dari <video>/<canvas> ke JPEG dataURL.
 * (Bergantung DOM; dipakai di komponen, diverifikasi manual.)
 */
export function canvasToCompressedJpeg(canvas: HTMLCanvasElement, quality = 0.6): string {
  return canvas.toDataURL("image/jpeg", quality);
}
```

- [ ] **Step 4: Verifikasi lulus**

Run: `yarn test image`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/absensi/src/lib/image.ts apps/absensi/src/lib/image.test.ts
git commit -m "feat(m1): util kompres & estimasi ukuran selfie"
```

---

## Task 13: Tipe & client submit attendance (TDD dengan fetch mock)

**Files:**
- Create: `apps/absensi/src/lib/attendance/types.ts`
- Create: `apps/absensi/src/lib/attendance/submit.ts`
- Create: `apps/absensi/src/lib/attendance/submit.test.ts`

- [ ] **Step 1: Tulis tipe**

`types.ts`:

```typescript
export type AttendanceType = "in" | "out";

export type AttendancePayload = {
  id: string;                 // UUID client (idempotency)
  outlet_staff_id: string;
  type: AttendanceType;
  gps_lat: number;
  gps_lng: number;
  match_distance: number;
  selfie_path: string | null;
  ts_client: string;
  from_queue: boolean;
};

export type SubmitResult =
  | { ok: true; status: "tepat" | "telat"; distance_m: number; ts_server: string; attendance_id: string }
  | { ok: false; reason: string; distance_m?: number };
```

- [ ] **Step 2: Tulis test (mock fetch)**

`submit.test.ts`:

```typescript
import { describe, expect, test, vi } from "vitest";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

const payload: AttendancePayload = {
  id: "11111111-1111-1111-1111-111111111111",
  outlet_staff_id: "staff-1",
  type: "in",
  gps_lat: -6.2, gps_lng: 106.84,
  match_distance: 0.38,
  selfie_path: "outlet-1/abc.jpg",
  ts_client: "2026-06-09T09:03:00+07:00",
  from_queue: false,
};

describe("submitAttendance", () => {
  test("mengirim POST ke endpoint function dengan auth dan mengembalikan hasil ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, status: "tepat", distance_m: 12, ts_server: "x", attendance_id: payload.id }), { status: 200 }),
    );
    const res = await submitAttendance(payload, {
      functionUrl: "https://proj.supabase.co/functions/v1/submit-attendance",
      accessToken: "jwt-abc",
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(true);
    const [calledUrl, init] = fetchMock.mock.calls[0]!;
    expect(calledUrl).toContain("/submit-attendance");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer jwt-abc" });
  });

  test("meneruskan hasil outside_radius apa adanya", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, reason: "outside_radius", distance_m: 320 }), { status: 200 }),
    );
    const res = await submitAttendance(payload, {
      functionUrl: "u", accessToken: "t", fetchImpl: fetchMock,
    });
    expect(res).toEqual({ ok: false, reason: "outside_radius", distance_m: 320 });
  });
});
```

- [ ] **Step 3: Verifikasi gagal**

Run: `cd apps/absensi && yarn test submit`
Expected: FAIL — `submit.ts` belum ada.

- [ ] **Step 4: Tulis implementasi**

`submit.ts`:

```typescript
import type { AttendancePayload, SubmitResult } from "./types";

export type SubmitOptions = {
  functionUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
};

export async function submitAttendance(
  payload: AttendancePayload,
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const f = opts.fetchImpl ?? fetch;
  const res = await f(opts.functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as SubmitResult;
}
```

- [ ] **Step 5: Verifikasi lulus**

Run: `yarn test submit`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/absensi/src/lib/attendance/
git commit -m "feat(m1): client submitAttendance + tipe payload"
```

---

## Task 14: Hook antrian absensi (replay via @suka/offline-queue)

Bungkus `useOfflineQueue` untuk: upload selfie tertunda → submit → hapus dari antrian saat sukses.

**Files:**
- Create: `apps/absensi/src/lib/attendance/useAttendanceQueue.ts`

> Catatan: hook React (DOM) — diverifikasi via integrasi/manual (Task 18). Tidak ada unit test terpisah; logika murni (submit, status, gps) sudah teruji di task lain.

- [ ] **Step 1: Tulis hook**

```typescript
"use client";

import { useOfflineQueue } from "@suka/offline-queue";
import { createClient } from "@/lib/supabase";
import { submitAttendance } from "./submit";
import type { AttendancePayload } from "./types";

// Item antrian: payload + selfie dataURL (diupload saat sync).
type QueuedAbsen = { payload: AttendancePayload; selfieDataUrl: string | null };

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`;

export function useAttendanceQueue() {
  const queue = useOfflineQueue<QueuedAbsen>("ss-absensi-queue");
  const supabase = createClient();

  async function uploadSelfie(outletId: string, id: string, dataUrl: string): Promise<string> {
    const path = `${outletId}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("selfies").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    return path;
  }

  async function syncOne(item: QueuedAbsen, outletId: string, token: string) {
    let selfiePath = item.payload.selfie_path;
    if (!selfiePath && item.selfieDataUrl) {
      selfiePath = await uploadSelfie(outletId, item.payload.id, item.selfieDataUrl);
    }
    return submitAttendance(
      { ...item.payload, selfie_path: selfiePath, from_queue: true },
      { functionUrl: FUNCTION_URL, accessToken: token },
    );
  }

  /** Tambah absen ke antrian (dipakai saat offline). */
  function enqueue(payload: AttendancePayload, selfieDataUrl: string | null) {
    return queue.add({ payload, selfieDataUrl });
  }

  /** Flush semua antrian saat online. */
  async function flush(outletId: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await queue.flush(async (items) => {
      for (const it of items) {
        const res = await syncOne(it.data, outletId, token);
        if (!res.ok && res.reason !== "outside_radius") throw new Error(res.reason);
      }
    });
  }

  return { enqueue, flush, isOnline: queue.isOnline, pending: queue.items.length };
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/lib/attendance/useAttendanceQueue.ts
git commit -m "feat(m1): hook antrian absensi (replay offline via @suka/offline-queue)"
```

---

## Task 15: Wrapper face-api.js (load model + descriptor)

**Files:**
- Create: `apps/absensi/src/lib/face/recognizer.ts`
- Create: `apps/absensi/public/models/.gitkeep`

> Catatan: bergantung DOM + model file — diverifikasi manual (Task 18). Logika match murni sudah di `match.ts`.

- [ ] **Step 1: Tulis wrapper**

```typescript
"use client";

import * as faceapi from "face-api.js";

let loaded = false;

/** Load model sekali (dari /models). */
export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  const url = "/models";
  await faceapi.nets.tinyFaceDetector.loadFromUri(url);
  await faceapi.nets.faceLandmark68Net.loadFromUri(url);
  await faceapi.nets.faceRecognitionNet.loadFromUri(url);
  loaded = true;
}

/** Ekstrak satu descriptor[128] dari elemen video/gambar. Null bila wajah tak terdeteksi. */
export async function extractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<number[] | null> {
  const det = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det ? Array.from(det.descriptor) : null;
}
```

- [ ] **Step 2: Dokumentasikan unduhan model**

Tambah ke `apps/absensi/README.md`:

```markdown
## Model face-api.js
Unduh weights ke `public/models/` (tiny_face_detector, face_landmark_68, face_recognition)
dari https://github.com/justadudewhohacks/face-api.js/tree/master/weights
```

- [ ] **Step 3: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error (face-api.js terpasang).

- [ ] **Step 4: Commit**

```bash
git add apps/absensi/src/lib/face/recognizer.ts apps/absensi/public/models/.gitkeep apps/absensi/README.md
git commit -m "feat(m1): wrapper face-api.js (load model + extract descriptor)"
```

---

## Task 16: Komponen CameraCapture

**Files:**
- Create: `apps/absensi/src/components/CameraCapture.tsx`

> Komponen DOM — verifikasi manual (Task 18).

- [ ] **Step 1: Tulis komponen**

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  onReady?: (video: HTMLVideoElement) => void;
  onError?: (e: string) => void;
};

/** Live camera (kamera depan) untuk face match & selfie. */
export function CameraCapture({ onReady, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onReady?.(videoRef.current);
        }
      } catch {
        onError?.("Tidak bisa mengakses kamera. Aktifkan izin kamera.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return <video ref={videoRef} playsInline muted className="w-full rounded-lg" />;
}

/** Ambil frame video → dataURL JPEG. */
export function captureFrame(video: HTMLVideoElement, quality = 0.6): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return { canvas, dataUrl: canvas.toDataURL("image/jpeg", quality) };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/absensi/src/components/CameraCapture.tsx
git commit -m "feat(m1): komponen CameraCapture + captureFrame"
```

---

## Task 17: Halaman clock-in/out (crew)

Alur: load staff outlet → pilih nama → kamera → match 1:1 → GPS → selfie → submit/queue.

**Files:**
- Create: `apps/absensi/src/app/clock/page.tsx`

> Halaman DOM — verifikasi manual (Task 18). Semua logika murni yang dipanggil sudah teruji.

- [ ] **Step 1: Tulis halaman**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { loadFaceModels, extractDescriptor } from "@/lib/face/recognizer";
import { isMatch } from "@/lib/face/match";
import { useAttendanceQueue } from "@/lib/attendance/useAttendanceQueue";
import { submitAttendance } from "@/lib/attendance/submit";
import type { AttendancePayload } from "@/lib/attendance/types";

type Staff = { id: string; name: string; face_descriptor: number[] | null };

export default function ClockPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const queue = useAttendanceQueue();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadFaceModels();
    if (!outletStaff) return;
    supabase.from("outlet_staff")
      .select("id,name,face_descriptor")
      .eq("outlet_id", outletStaff.outlet_id)
      .not("face_descriptor", "is", null)
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [outletStaff]);

  async function doClock(type: "in" | "out") {
    if (!selected || !video || !outletStaff) return;
    setMsg("Memproses wajah...");
    const live = await extractDescriptor(video);
    if (!live) return setMsg("Wajah tidak terdeteksi, coba lagi.");
    if (!selected.face_descriptor || !isMatch(live, selected.face_descriptor)) {
      return setMsg("❌ Wajah tidak cocok.");
    }

    setMsg("Mengambil lokasi...");
    let pos: GeolocationPosition;
    try {
      pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true }));
    } catch { return setMsg("Tidak bisa mengambil lokasi. Aktifkan GPS."); }

    const { dataUrl } = captureFrame(video);
    const id = crypto.randomUUID();
    const payload: AttendancePayload = {
      id, outlet_staff_id: selected.id, type,
      gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude,
      match_distance: 0, selfie_path: null,
      ts_client: new Date().toISOString(), from_queue: false,
    };

    if (!navigator.onLine) {
      queue.enqueue(payload, dataUrl);
      return setMsg("📴 Tersimpan offline, akan sinkron saat online.");
    }

    // Online: upload selfie → submit
    const path = `${outletStaff.outlet_id}/${id}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("selfies").upload(path, blob, { contentType: "image/jpeg" });
    const { data: s } = await supabase.auth.getSession();
    const res = await submitAttendance(
      { ...payload, selfie_path: path },
      { functionUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit-attendance`, accessToken: s.session!.access_token },
    );
    setMsg(res.ok ? `✅ Absen ${res.status}` : `❌ ${res.reason}${res.distance_m ? ` (${res.distance_m}m)` : ""}`);
  }

  useEffect(() => { if (navigator.onLine && outletStaff) queue.flush(outletStaff.outlet_id); }, [outletStaff]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Absensi</h1>
      <select className="w-full border rounded p-2"
        onChange={(e) => setSelected(staff.find((s) => s.id === e.target.value) ?? null)}>
        <option value="">Pilih nama…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {selected && (
        <Card>
          <CameraCapture onReady={setVideo} onError={setMsg} />
          <div className="flex gap-2 mt-3">
            <Button onClick={() => doClock("in")}>Clock-in</Button>
            <Button onClick={() => doClock("out")}>Clock-out</Button>
          </div>
        </Card>
      )}
      {msg && <p className="text-center">{msg}</p>}
      {!queue.isOnline && <p className="text-amber-600 text-sm">Offline — {queue.pending} menunggu sync</p>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error.

- [ ] **Step 3: Commit**

```bash
git add apps/absensi/src/app/clock/page.tsx
git commit -m "feat(m1): halaman clock-in/out (face match + GPS + selfie + offline)"
```

---

## Task 18: Halaman enroll wajah (SPV)

**Files:**
- Create: `apps/absensi/src/app/enroll/page.tsx`

- [ ] **Step 1: Tulis halaman**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { CameraCapture, captureFrame } from "@/components/CameraCapture";
import { loadFaceModels, extractDescriptor } from "@/lib/face/recognizer";
import { averageDescriptors } from "@/lib/face/match";

type Staff = { id: string; name: string };

export default function EnrollPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [targetId, setTargetId] = useState("");
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [shots, setShots] = useState<number[][]>([]);
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadFaceModels();
    if (!outletStaff) return;
    supabase.from("outlet_staff").select("id,name").eq("outlet_id", outletStaff.outlet_id)
      .then(({ data }) => setStaff((data as Staff[]) ?? []));
  }, [outletStaff]);

  async function takeShot() {
    if (!video) return;
    const d = await extractDescriptor(video);
    if (!d) return setMsg("Wajah tidak terdeteksi.");
    setShots((prev) => [...prev, d]);
    setMsg(`Foto ${shots.length + 1}/3 diambil.`);
  }

  async function save() {
    if (!targetId || shots.length === 0 || !consent || !outletStaff || !video) return;
    const descriptor = averageDescriptors(shots);
    const { dataUrl } = captureFrame(video);
    const refPath = `${outletStaff.outlet_id}/${targetId}.jpg`;
    const blob = await (await fetch(dataUrl)).blob();
    await supabase.storage.from("face-refs").upload(refPath, blob, { upsert: true, contentType: "image/jpeg" });
    const { error } = await supabase.from("outlet_staff").update({
      face_descriptor: descriptor,
      ref_photo_url: refPath,
      consent_at: new Date().toISOString(),
      consent_by: outletStaff.id,
      enrolled_at: new Date().toISOString(),
    }).eq("id", targetId);
    setMsg(error ? `❌ ${error.message}` : "✅ Enroll tersimpan.");
    setShots([]);
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Enroll Wajah Staff</h1>
      <select className="w-full border rounded p-2" value={targetId}
        onChange={(e) => setTargetId(e.target.value)}>
        <option value="">Pilih staff…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Staff menyetujui pemrosesan data biometrik (UU PDP).
      </label>
      {targetId && consent && (
        <Card>
          <CameraCapture onReady={setVideo} onError={setMsg} />
          <div className="flex gap-2 mt-3">
            <Button onClick={takeShot} disabled={shots.length >= 3}>Ambil foto ({shots.length}/3)</Button>
            <Button onClick={save} disabled={shots.length === 0}>Simpan</Button>
          </div>
        </Card>
      )}
      {msg && <p className="text-center">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error.

```bash
git add apps/absensi/src/app/enroll/page.tsx
git commit -m "feat(m1): halaman enroll wajah (SPV) + consent"
```

---

## Task 19: Halaman rekap kehadiran (SPV)

**Files:**
- Create: `apps/absensi/src/app/rekap/page.tsx`

- [ ] **Step 1: Tulis halaman**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Badge, Card } from "@suka/design-system";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

type Row = {
  id: string; type: "in" | "out"; ts_server: string; ts_client: string | null;
  status: "tepat" | "telat" | "alpha"; selfie_url: string | null;
  outlet_staff: { name: string } | null;
};

export default function RekapPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!outletStaff) return;
    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;
    supabase.from("attendance")
      .select("id,type,ts_server,ts_client,status,selfie_url,outlet_staff(name)")
      .eq("outlet_id", outletStaff.outlet_id)
      .gte("ts_server", start).lte("ts_server", end)
      .order("ts_server", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [outletStaff, date]);

  const color = (s: string) => s === "tepat" ? "green" : s === "telat" ? "amber" : "red";

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">Rekap Kehadiran</h1>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded p-2" />
      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{r.outlet_staff?.name}</p>
                <p className="text-sm text-gray-500">
                  {r.type} · {new Date(r.ts_server).toLocaleTimeString("id-ID")}
                </p>
              </div>
              <Badge color={color(r.status)}>{r.status}</Badge>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-gray-500">Belum ada data untuk tanggal ini.</p>}
      </div>
    </div>
  );
}
```

> Catatan: `selfie_url` butuh `supabase.storage.from('selfies').createSignedUrl()` untuk ditampilkan; tambahkan thumbnail signed-url saat polish. Properti `Badge color` — sesuaikan dengan API `@suka/design-system/Badge` (cek props yang tersedia; jika hanya menerima `variant`, map status→variant).

- [ ] **Step 2: Type-check + commit**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error (sesuaikan props Badge bila perlu).

```bash
git add apps/absensi/src/app/rekap/page.tsx
git commit -m "feat(m1): halaman rekap kehadiran (SPV)"
```

---

## Task 20: Job mark-alpha (pg_cron harian)

Tandai staff aktif yang tak clock-in hari ini sebagai `alpha`.

**Files:**
- Create: `supabase/migrations/20260610000500_m1_cron_mark_alpha.sql`

- [ ] **Step 1: Tulis fungsi + jadwal**

```sql
-- M1: tandai alpha untuk staff aktif tanpa clock-in 'in' hari kemarin.
-- Dijalankan tiap hari 23:55 (untuk hari berjalan) atau bisa 00:05 hari berikutnya.
CREATE OR REPLACE FUNCTION mark_alpha_for(target_date DATE)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO attendance (id, outlet_staff_id, outlet_id, type, ts_server, status)
  SELECT gen_random_uuid(), s.id, s.outlet_id, 'in', (target_date + TIME '23:59'), 'alpha'
  FROM outlet_staff s
  WHERE s.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM attendance a
      WHERE a.outlet_staff_id = s.id
        AND a.type = 'in'
        AND a.ts_server::date = target_date
    );
$$;

SELECT cron.schedule('mark-alpha', '55 23 * * *', $$ SELECT mark_alpha_for(CURRENT_DATE); $$);

-- DOWN:
-- SELECT cron.unschedule('mark-alpha');
-- DROP FUNCTION IF EXISTS mark_alpha_for(DATE);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260610000500_m1_cron_mark_alpha.sql
git commit -m "feat(m1): job pg_cron mark-alpha (tandai mangkir harian)"
```

---

## Task 21: Verifikasi menyeluruh & deploy

- [ ] **Step 1: Jalankan semua unit test app**

Run: `cd apps/absensi && yarn test`
Expected: PASS — gps (7), face/match (12), image (3), submit (2). Total 24.

- [ ] **Step 2: Jalankan test Edge Function (Deno)**

Run: `cd supabase/functions && deno test`
Expected: PASS — haversine (2) + status (4).

- [ ] **Step 3: Type-check seluruh app**

Run: `cd apps/absensi && yarn type-check`
Expected: tidak ada error.

- [ ] **Step 4: Apply migrations ke project Outlet Suite**

Run: `npx supabase db push`
Expected: 6 migration M1 ter-apply tanpa error.

- [ ] **Step 5: Deploy Edge Functions**

Run: `npx supabase functions deploy submit-attendance`
Expected: deploy sukses.

- [ ] **Step 6: Verifikasi E2E manual (sesuai PRD §M1)**

Checklist (device/browser dengan akun SPV outlet uji):
- Enroll staff → descriptor & ref tersimpan.
- Clock-in wajah benar → match → dalam radius → ✅ tepat/telat.
- Wajah orang lain → ❌ ditolak (tidak ada record).
- Di luar radius (mock GPS) → ❌ outside_radius (tidak ada record).
- Matikan jaringan → clock-in → tersimpan offline; nyalakan → auto-sync; satu record (idempoten).
- Rekap SPV menampilkan absen + status; outlet lain tak terlihat (uji RLS dengan akun outlet berbeda).

- [ ] **Step 7: Build static export**

Run: `cd apps/absensi && yarn build`
Expected: folder `out/` terbentuk (static export) tanpa error.

- [ ] **Step 8: Push branch & buka PR**

```bash
git push
```
Buka PR `feat/m1-absensi` → `main`. Minta review Dev B untuk migration yang menyentuh `outlet_staff` (kolom enroll).

---

## Self-Review (sudah dijalankan saat penulisan)

- **Spec coverage:** clock-in/out+face+GPS (Task 16–17), enroll SPV (Task 18), rekap SPV (Task 19), consent+retensi (Task 3, 7, 18), Edge Function server-authoritative (Task 9–11), offline+idempoten (Task 13–14, 17), status tepat/telat (Task 10), alpha via cron (Task 20), RLS per-outlet (Task 6). ✓
- **Divergensi M0 ter-handle:** auth per-staff via akun SPV pada device (Task 11, 17); kolom enroll ditambah (Task 3); offline pakai `@suka/offline-queue` localStorage + selfie dataURL (Task 12–14). ✓
- **Type consistency:** `AttendancePayload`/`SubmitResult` (Task 13) dipakai konsisten di submit (13), queue (14), clock (17); `computeStatus` (Task 10) dipakai di handler (11); `haversineMeters` shared (9) di handler (11). ✓
- **Catatan terbuka (bukan placeholder):** props `Badge` design-system perlu dicek saat Task 19; signed-url thumbnail selfie di rekap = polish setelah MVP. Keduanya ditandai eksplisit di task.
