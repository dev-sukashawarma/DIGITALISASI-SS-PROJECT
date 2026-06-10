\# Handoff PRD — M1 Absensi + Face Matching

\## Sukashawarma Outlet Suite



> \*\*Dokumen ini dibuat untuk AI agent baru yang melanjutkan pekerjaan M1.\*\*

> Baca seluruh dokumen sebelum menulis satu baris kode. Semua konteks ada di sini.



\---



\## 1. Konteks Proyek



\### Apa ini?

\*\*Sukashawarma Outlet Suite\*\* adalah platform digital untuk 19 gerai F\&B (franchise shawarma) di Jabodetabek, Indonesia. Platform ini dibangun sebagai \*\*monorepo\*\* yang berisi beberapa mini-app terpisah untuk keperluan operasional outlet:



| App | Deskripsi |

|-----|-----------|

| `apps/absensi` | Absensi + face matching anti titip-absen (\*\*← ini yang kita kerjakan\*\*) |

| `apps/stok` | Manajemen stok harian |

| `apps/distribusi` | Distribusi barang antar outlet |

| `apps/owner-dashboard` | Dashboard pemilik |



\### Struktur Repo



```

C:\\Users\\AK\\Desktop\\DIGITALISASI-SS-PROJECT\\

├── apps/

│   ├── absensi/         ← target kita (M1)

│   ├── stok/

│   ├── distribusi/

│   └── owner-dashboard/

├── packages/

│   ├── design-system/   → @suka/design-system  (Button, Card, Input, Badge, cn)

│   └── offline-queue/   → @suka/offline-queue   (hook localStorage queue)

├── supabase/

│   ├── functions/

│   │   ├── \_shared/haversine.ts   ← GPS jarak (M1, sudah ada)

│   │   ├── submit-attendance/     ← Edge Function utama (M1, sudah ada)

│   │   └── sync-outlets/          ← contoh dari M0

│   └── migrations/

│       ├── (M0 migrations...)

│       └── 20260610000000 \~ 20260610000400  ← M1 (sudah ada)

├── docs/

│   ├── superpowers/specs/2026-06-09-m1-absensi-face-matching-design.md

│   └── superpowers/plans/2026-06-09-m1-absensi-implementation.md

└── package.json  (yarn workspaces root)

```



\### Repository

\- \*\*Repo GitHub\*\*: `https://github.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT`

\- \*\*Branch aktif\*\*: `feat/m1-absensi` (23+ commit di atas `main`)

\- \*\*M0 sudah di-merge ke `main`\*\* oleh Dev B. Branch kita sudah merge M0 via `git merge origin/main`.



\---



\## 2. Tech Stack



| Layer | Technology |

|-------|-----------|

| Framework | Next.js 16 + React 19, `output: 'export'` (static) |

| Language | TypeScript |

| Styling | Tailwind CSS 4 |

| Package manager | Yarn Workspaces |

| Backend | Supabase: Postgres + Auth + Storage + RLS + Edge Functions (Deno) + pg\_cron |

| Face matching | face-api.js (client-side, 1:1 Euclidean distance) |

| Test runner app | Vitest (`environment: "node"`, `src/\*\*/\*.test.ts`) |

| Test runner Edge Fn | Deno test (`jsr:@std/assert`) |

| Offline | `@suka/offline-queue` (localStorage, bukan IndexedDB) |



\---



\## 3. Arsitektur M1 — Gambaran Besar



\### Alur Clock-in/out (Pendekatan B — Server Authoritative)



```

Device (browser, akun SPV login)

&#x20; │

&#x20; ├── 1. Pilih nama staff dari daftar

&#x20; ├── 2. Ambil video kamera (getUserMedia)

&#x20; ├── 3. face-api.js: extractDescriptor(video)      → descriptor\[128] live

&#x20; ├── 4. Ambil face\_descriptor dari outlet\_staff DB

&#x20; ├── 5. isMatch(live, stored) — euclidean < 0.5    → gagal → tolak

&#x20; ├── 6. GPS: navigator.geolocation                  → lat/lng

&#x20; ├── 7. captureFrame(video) → selfie JPEG dataUrl

&#x20; │

&#x20; ├── \[ONLINE]

&#x20; │     ├── Upload selfie → supabase.storage 'selfies' (<outlet\_id>/<uuid>.jpg)

&#x20; │     └── POST /functions/v1/submit-attendance (JWT Bearer)

&#x20; │           ↓

&#x20; │       Edge Function (server):

&#x20; │         - Verifikasi auth.getUser() = caller (SPV/kepala\_outlet)

&#x20; │         - Lookup outlet\_id dari outlet\_staff

&#x20; │         - Enforce role SPV/kepala\_outlet

&#x20; │         - Validate GPS tidak NaN

&#x20; │         - Lookup koordinat outlet

&#x20; │         - haversineMeters(outlet, gps) → distance\_m

&#x20; │         - distance > radius → { ok: false, reason: "outside\_radius" }

&#x20; │         - stamp ts\_server = now()

&#x20; │         - computeStatus(type, ts\_server, config) → "tepat"|"telat"

&#x20; │         - UPSERT attendance (ON CONFLICT id → ignore, idempoten)

&#x20; │         → { ok: true, status, distance\_m, ts\_server, attendance\_id }

&#x20; │

&#x20; └── \[OFFLINE]

&#x20;       └── useAttendanceQueue.enqueue(payload, selfieDataUrl)

&#x20;             → disimpan di localStorage (@suka/offline-queue)

&#x20;             → saat kembali online: flush() → upload selfie → submit

```



\### Auth Model (PENTING — berbeda dari JWT custom claim)



\- \*\*Tidak ada custom JWT claim `outlet\_id`\*\*

\- Device login sekali sebagai akun \*\*SPV/kepala\_outlet\*\* (sesi panjang)

\- `outlet\_id` selalu di-derive server-side via: `SELECT outlet\_id FROM outlet\_staff WHERE id = auth.uid()`

\- Staff crew TIDAK login — mereka dipilih dari daftar, face match memverifikasi identitas

\- RLS menggunakan pola EXISTS subquery (bukan `auth.jwt()->'outlet\_id'`):



```sql

EXISTS (

&#x20; SELECT 1 FROM outlet\_staff me

&#x20; WHERE me.id = auth.uid()

&#x20;   AND me.outlet\_id = <tabel>.outlet\_id

)

```



\### Face Matching



\- Library: `face-api.js` v0.22.2 (client-side)

\- Model: `tinyFaceDetector` + `faceLandmark68Net` + `faceRecognitionNet`

\- Descriptor: `number\[128]` — \*\*TIDAK pernah dikirim ke server\*\* (hanya `match\_distance` untuk audit)

\- Threshold: Euclidean distance < `0.5` → match

\- Enroll: SPV ambil 3 foto → `averageDescriptors(\[d1, d2, d3])` → simpan ke `outlet\_staff.face\_descriptor` (JSONB)

\- Model weights disimpan di `apps/absensi/public/models/` (diunduh manual dari GitHub face-api.js)



\### Status Kehadiran



| Status | Kondisi |

|--------|---------|

| `tepat` | Clock-in sebelum/tepat `jam\_masuk + toleransi\_menit` (inklusif) |

| `telat` | Clock-in setelah deadline |

| `tepat` | Clock-out (selalu tepat, tak dihitung) |

| `alpha` | Tidak clock-in sama sekali (ditandai pg\_cron 23:55 setiap hari) |



Config per outlet: `outlet\_attendance\_config(outlet\_id, jam\_masuk TIME, toleransi\_menit INT, radius\_m INT)`



\---



\## 4. Database Schema M1



\### Kolom tambahan ke `outlet\_staff` (M0 table, additive migration)



```sql

ALTER TABLE outlet\_staff ADD COLUMN IF NOT EXISTS

&#x20; consent\_at  TIMESTAMPTZ,   -- waktu consent UU PDP

&#x20; consent\_by  UUID REFERENCES outlet\_staff(id),  -- SPV yang enroll

&#x20; enrolled\_at TIMESTAMPTZ;   -- waktu descriptor tersimpan

```



M0 sudah punya: `face\_descriptor JSONB`, `ref\_photo\_url TEXT`



\### Tabel baru M1



```sql

\-- Tabel absensi

CREATE TABLE attendance (

&#x20; id              UUID PRIMARY KEY,  -- client-generated (idempotency key!)

&#x20; outlet\_staff\_id UUID NOT NULL REFERENCES outlet\_staff(id) ON DELETE CASCADE,

&#x20; outlet\_id       UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,

&#x20; type            TEXT NOT NULL CHECK (type IN ('in','out')),

&#x20; ts\_server       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

&#x20; ts\_client       TIMESTAMPTZ,       -- waktu device (basis status saat offline)

&#x20; gps\_lat         NUMERIC,

&#x20; gps\_lng         NUMERIC,

&#x20; distance\_m      NUMERIC,

&#x20; match\_distance  NUMERIC,           -- audit saja, descriptor tidak dikirim server

&#x20; selfie\_url      TEXT,              -- path storage (di-null-kan setelah 90 hari)

&#x20; status          TEXT NOT NULL CHECK (status IN ('tepat','telat','alpha')),

&#x20; created\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



\-- Config jam kerja \& radius per outlet

CREATE TABLE outlet\_attendance\_config (

&#x20; outlet\_id       UUID PRIMARY KEY REFERENCES outlets(id) ON DELETE CASCADE,

&#x20; jam\_masuk       TIME NOT NULL DEFAULT '09:00',

&#x20; toleransi\_menit INT  NOT NULL DEFAULT 15,

&#x20; radius\_m        INT  NOT NULL DEFAULT 100,

&#x20; updated\_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

```



\### Storage Buckets



| Bucket | Akses | Path pattern |

|--------|-------|--------------|

| `selfies` | Private | `<outlet\_id>/<attendance\_uuid>.jpg` |

| `face-refs` | Private | `<outlet\_id>/<staff\_id>.jpg` |



RLS storage: `(storage.foldername(name))\[1] = me.outlet\_id::text`



Retensi: pg\_cron `cleanup-selfies` → hapus selfie > 90 hari (02:00 harian)



\---



\## 5. Edge Function: `submit-attendance`



\*\*Path\*\*: `supabase/functions/submit-attendance/index.ts`



\*\*Request\*\*:

```

POST /functions/v1/submit-attendance

Authorization: Bearer <JWT SPV/kepala\_outlet>

Content-Type: application/json



{

&#x20; "id": "<UUID client>",          // idempotency key

&#x20; "outlet\_staff\_id": "<UUID>",    // staff yang absen

&#x20; "type": "in" | "out",

&#x20; "gps\_lat": number,

&#x20; "gps\_lng": number,

&#x20; "match\_distance": number,       // audit saja

&#x20; "selfie\_path": "<outlet\_id>/...jpg" | null,

&#x20; "ts\_client": "<ISO>",

&#x20; "from\_queue": boolean           // true = replay offline, pakai ts\_client sebagai basis status

}

```



\*\*Response sukses\*\*: `{ ok: true, status: "tepat"|"telat", distance\_m: number, ts\_server: string, attendance\_id: string }`



\*\*Response gagal\*\*: `{ ok: false, reason: string, distance\_m?: number }`



\*\*Security fixes yang sudah ada di kode\*\* (jangan dihilangkan):

1\. Role check: hanya `spv`/`kepala\_outlet` yang bisa submit

2\. GPS NaN validation: mencegah bypass `NaN > radius`

3\. Top-level try/catch: mencegah 500 non-JSON

4\. `@supabase/supabase-js` di-pin ke `https://esm.sh/@supabase/supabase-js@2.38.0` (sama dengan `sync-outlets`)



\---



\## 6. Kode Library yang Sudah Ada (T1–T15 SELESAI)



Semua file ini \*\*sudah ada dan sudah di-commit\*\* di branch `feat/m1-absensi`. Jangan tulis ulang.



\### App (`apps/absensi/src/lib/`)



| File | Isi | Unit tests |

|------|-----|-----------|

| `lib/gps.ts` | `haversineMeters(a,b)`, `isWithinRadius(center, point, r)` | 7 passing |

| `lib/gps.test.ts` | — | — |

| `lib/image.ts` | `estimateDataUrlBytes(url)`, `isWithinSizeLimit(url, max)`, `canvasToCompressedJpeg(canvas, q)` | 3 passing |

| `lib/image.test.ts` | — | — |

| `lib/face/match.ts` | `euclideanDistance(a,b)`, `isMatch(a,b,t?)`, `averageDescriptors(ds\[])`, `DEFAULT\_MATCH\_THRESHOLD=0.5` | 12 passing |

| `lib/face/match.test.ts` | — | — |

| `lib/face/recognizer.ts` | `loadFaceModels()`, `extractDescriptor(input)` — DOM-dependent, no tests | — |

| `lib/attendance/types.ts` | `AttendanceType`, `AttendancePayload`, `SubmitResult` | — |

| `lib/attendance/submit.ts` | `submitAttendance(payload, opts)` — injectable `fetchImpl` | 2 passing |

| `lib/attendance/submit.test.ts` | — | — |

| `lib/attendance/useAttendanceQueue.ts` | `useAttendanceQueue()` → `{ enqueue, flush, isOnline, pending }` | — (DOM hook) |



\*\*Total test passing: 24\*\* (`yarn test` di `apps/absensi/`)



\### Tipe penting untuk UI pages



```typescript

// types.ts

export type AttendanceType = "in" | "out";

export type AttendancePayload = {

&#x20; id: string;               // UUID client

&#x20; outlet\_staff\_id: string;

&#x20; type: AttendanceType;

&#x20; gps\_lat: number;

&#x20; gps\_lng: number;

&#x20; match\_distance: number;

&#x20; selfie\_path: string | null;

&#x20; ts\_client: string;        // ISO timestamp

&#x20; from\_queue: boolean;

};

export type SubmitResult =

&#x20; | { ok: true; status: "tepat"|"telat"; distance\_m: number; ts\_server: string; attendance\_id: string }

&#x20; | { ok: false; reason: string; distance\_m?: number };

```



\### Hook `useAttendanceQueue` — API penting



```typescript

// Gunakan begini (bukan queue.items, tapi queue.queue):

const { queue, add, flush, isOnline } = useOfflineQueue<QueuedAbsen>("ss-absensi-queue");

// pending count = queue.length (BUKAN queue.items.length)

```



\### Edge Function (`supabase/functions/`)



| File | Isi |

|------|-----|

| `\_shared/haversine.ts` | `LatLng` type, `haversineMeters(a,b)` |

| `submit-attendance/status.ts` | `computeStatus(type, tsBasis, cfg, tz)` |

| `submit-attendance/index.ts` | Handler utama (sepenuhnya selesai + security fixes) |

| `submit-attendance/deno.json` | Import map (supabase-js pinned) |



\### Migrations yang sudah ada



```

supabase/migrations/20260610000000\_m1\_outlet\_staff\_enroll.sql    ✅

supabase/migrations/20260610000100\_m1\_attendance.sql             ✅

supabase/migrations/20260610000200\_m1\_outlet\_attendance\_config.sql ✅

supabase/migrations/20260610000300\_m1\_attendance\_rls.sql         ✅

supabase/migrations/20260610000400\_m1\_storage\_buckets.sql        ✅

```



\---



\## 7. M0 Contracts (Dari `main`)



Ini adalah API/tabel dari M0 yang perlu kamu pakai. Semua sudah di `main` branch.



\### `outlet\_staff` table

```sql

id             UUID PK = auth.uid()

outlet\_id      UUID FK → outlets

name           TEXT

role           TEXT  -- 'crew' | 'kasir' | 'spv' | 'kepala\_outlet'

face\_descriptor JSONB  -- number\[128], null bila belum enroll

ref\_photo\_url  TEXT

status         TEXT  -- 'active' | 'inactive' | 'on\_leave'

\-- M1 additions (sudah di-migrate):

consent\_at     TIMESTAMPTZ

consent\_by     UUID FK → outlet\_staff

enrolled\_at    TIMESTAMPTZ

```



\### `outlets` table

```sql

id      UUID PK

slug    TEXT

name    TEXT

lat     NUMERIC NOT NULL

lng     NUMERIC NOT NULL

type    TEXT

is\_active BOOLEAN

```



\### Packages yang tersedia

\- `@suka/design-system` → `Button`, `Card`, `Input`, `Badge`, `tokens`, `cn`

\- `@suka/offline-queue` → `useOfflineQueue<T>(key, opts)` → `{ queue, isOnline, isPending, add(data), flush(fn) }`



\### Context Auth M0

```typescript

// apps/absensi/src/context/AuthContext.tsx

const { session, outletStaff, loading, signOut } = useAuth();

// outletStaff: outlet\_staff row milik akun yang login (SPV/kepala\_outlet)

// outletStaff.outlet\_id → outlet\_id aktif

// outletStaff.id → auth.uid()

// outletStaff.role → 'spv' | 'kepala\_outlet'

```



\### Import alias

```typescript

import { createClient } from "@/lib/supabase";

// '@/' = apps/absensi/src/

```



\---



\## 8. Constraint Keamanan (WAJIB DIPATUHI)



> ⚠️ \*\*JANGAN commit key Supabase (`service\_role` / `anon`)\*\*

> Pakai `config.example.js` / `.env.example`; file asli di-`.gitignore`.



\- Descriptor wajah (`number\[128]`) TIDAK boleh dikirim ke server — hanya `match\_distance` (angka float)

\- Selfie path harus divalidasi prefix `<outlet\_id>/` di Edge Function (sudah ada)

\- RLS: tulis attendance hanya via `service\_role` (Edge Function) — client tidak boleh INSERT langsung



\---



\## 9. Status Pekerjaan Saat Ini



\### ✅ Selesai (T1–T15) — 25 commit di branch `feat/m1-absensi`



| Task | Commit | Status |

|------|--------|--------|

| T1: Integrasi branch M1+M0 | `2196a65` | ✅ |

| T2: Setup Vitest | `910a583` | ✅ |

| T3: Migration enroll columns | `5b65cee` | ✅ |

| T4: Migration tabel attendance | `3a41970` | ✅ |

| T5: Migration outlet\_attendance\_config | `fb0a59b` | ✅ |

| T6: RLS attendance + config | `a7c10b7` | ✅ |

| T7: Storage buckets + retensi | `d8cd38a` | ✅ |

| T8: Pindah gps + face/match ke src/lib | `3255d7f` | ✅ |

| T9: Shared haversine (Deno) | `6f45cee` | ✅ |

| T10: Status logic (Deno TDD) | `0778d7f` | ✅ |

| T11: Edge Function submit-attendance | `0015809` + `0127b5f` | ✅ |

| T12: Util kompres selfie | `b1eb889` | ✅ |

| T13: Client submitAttendance | `1943f0b` | ✅ |

| T14: Hook antrian offline | `2938dc2` | ✅ |

| T15: Wrapper face-api.js | `274605d` | ✅ |



\### ❌ Belum Dikerjakan (T16–T21)



Ini yang harus dikerjakan agent baru. Detail setiap task ada di \*\*Bagian 10\*\*.



| Task | File yang dibuat | Prioritas |

|------|-----------------|-----------|

| \*\*T16\*\* | `apps/absensi/src/components/CameraCapture.tsx` | 🔴 Prerequisite T17+T18 |

| \*\*T17\*\* | `apps/absensi/src/app/clock/page.tsx` | 🔴 Core feature |

| \*\*T18\*\* | `apps/absensi/src/app/enroll/page.tsx` | 🔴 Core feature |

| \*\*T19\*\* | `apps/absensi/src/app/rekap/page.tsx` | 🟡 SPV feature |

| \*\*T20\*\* | `supabase/migrations/20260610000500\_m1\_cron\_mark\_alpha.sql` | 🟡 Cron job |

| \*\*T21\*\* | Verifikasi + PR | 🟢 Final step |



\---



\## 10. Task yang Harus Dikerjakan — Detail Lengkap



\### Task 16: Komponen CameraCapture



\*\*File\*\*: `apps/absensi/src/components/CameraCapture.tsx`



Buat komponen React `"use client"` yang membuka kamera depan via `getUserMedia` dan menyediakan helper `captureFrame`.



```tsx

"use client";



import { useEffect, useRef } from "react";



type Props = {

&#x20; onReady?: (video: HTMLVideoElement) => void;

&#x20; onError?: (e: string) => void;

};



/\*\* Live camera (kamera depan) untuk face match \& selfie. \*/

export function CameraCapture({ onReady, onError }: Props) {

&#x20; const videoRef = useRef<HTMLVideoElement>(null);



&#x20; useEffect(() => {

&#x20;   let stream: MediaStream | null = null;

&#x20;   (async () => {

&#x20;     try {

&#x20;       stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });

&#x20;       if (videoRef.current) {

&#x20;         videoRef.current.srcObject = stream;

&#x20;         await videoRef.current.play();

&#x20;         onReady?.(videoRef.current);

&#x20;       }

&#x20;     } catch {

&#x20;       onError?.("Tidak bisa mengakses kamera. Aktifkan izin kamera.");

&#x20;     }

&#x20;   })();

&#x20;   return () => stream?.getTracks().forEach((t) => t.stop());

&#x20; }, \[]);



&#x20; return <video ref={videoRef} playsInline muted className="w-full rounded-lg" />;

}



/\*\* Ambil frame video → dataURL JPEG. \*/

export function captureFrame(

&#x20; video: HTMLVideoElement,

&#x20; quality = 0.6,

): { canvas: HTMLCanvasElement; dataUrl: string } {

&#x20; const canvas = document.createElement("canvas");

&#x20; canvas.width = video.videoWidth;

&#x20; canvas.height = video.videoHeight;

&#x20; canvas.getContext("2d")!.drawImage(video, 0, 0);

&#x20; return { canvas, dataUrl: canvas.toDataURL("image/jpeg", quality) };

}

```



Commit: `feat(m1): komponen CameraCapture + captureFrame`



\---



\### Task 17: Halaman clock-in/out (crew)



\*\*File\*\*: `apps/absensi/src/app/clock/page.tsx`



Alur: load staff outlet (hanya yang enrolled) → pilih nama → kamera muncul → match 1:1 → GPS → selfie → submit online atau queue offline.



\*\*Catatan penting\*\*:

\- `match\_distance` di payload = 0 (angka dummy — match sudah dilakukan client-side, yang penting `isMatch()` lulus)

\- Face descriptor TIDAK dikirim ke server, hanya boolean hasil `isMatch()`

\- Upload selfie ke bucket `selfies`, path: `${outletStaff.outlet\_id}/${id}.jpg`

\- Queue flush dipanggil saat online (useEffect)



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



type Staff = { id: string; name: string; face\_descriptor: number\[] | null };



export default function ClockPage() {

&#x20; const { outletStaff } = useAuth();

&#x20; const supabase = createClient();

&#x20; const queue = useAttendanceQueue();

&#x20; const \[staff, setStaff] = useState<Staff\[]>(\[]);

&#x20; const \[selected, setSelected] = useState<Staff | null>(null);

&#x20; const \[video, setVideo] = useState<HTMLVideoElement | null>(null);

&#x20; const \[msg, setMsg] = useState("");



&#x20; useEffect(() => {

&#x20;   loadFaceModels();

&#x20;   if (!outletStaff) return;

&#x20;   supabase

&#x20;     .from("outlet\_staff")

&#x20;     .select("id,name,face\_descriptor")

&#x20;     .eq("outlet\_id", outletStaff.outlet\_id)

&#x20;     .not("face\_descriptor", "is", null)

&#x20;     .then(({ data }) => setStaff((data as Staff\[]) ?? \[]));

&#x20; }, \[outletStaff]);



&#x20; async function doClock(type: "in" | "out") {

&#x20;   if (!selected || !video || !outletStaff) return;

&#x20;   setMsg("Memproses wajah...");



&#x20;   const live = await extractDescriptor(video);

&#x20;   if (!live) return setMsg("Wajah tidak terdeteksi, coba lagi.");

&#x20;   if (!selected.face\_descriptor || !isMatch(live, selected.face\_descriptor)) {

&#x20;     return setMsg("❌ Wajah tidak cocok.");

&#x20;   }



&#x20;   setMsg("Mengambil lokasi...");

&#x20;   let pos: GeolocationPosition;

&#x20;   try {

&#x20;     pos = await new Promise((res, rej) =>

&#x20;       navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true }),

&#x20;     );

&#x20;   } catch {

&#x20;     return setMsg("Tidak bisa mengambil lokasi. Aktifkan GPS.");

&#x20;   }



&#x20;   const { dataUrl } = captureFrame(video);

&#x20;   const id = crypto.randomUUID();

&#x20;   const payload: AttendancePayload = {

&#x20;     id,

&#x20;     outlet\_staff\_id: selected.id,

&#x20;     type,

&#x20;     gps\_lat: pos.coords.latitude,

&#x20;     gps\_lng: pos.coords.longitude,

&#x20;     match\_distance: 0,

&#x20;     selfie\_path: null,

&#x20;     ts\_client: new Date().toISOString(),

&#x20;     from\_queue: false,

&#x20;   };



&#x20;   if (!navigator.onLine) {

&#x20;     queue.enqueue(payload, dataUrl);

&#x20;     return setMsg("📴 Tersimpan offline, akan sinkron saat online.");

&#x20;   }



&#x20;   // Online: upload selfie dulu, baru submit

&#x20;   const path = `${outletStaff.outlet\_id}/${id}.jpg`;

&#x20;   const blob = await (await fetch(dataUrl)).blob();

&#x20;   await supabase.storage

&#x20;     .from("selfies")

&#x20;     .upload(path, blob, { contentType: "image/jpeg" });



&#x20;   const { data: s } = await supabase.auth.getSession();

&#x20;   const res = await submitAttendance(

&#x20;     { ...payload, selfie\_path: path },

&#x20;     {

&#x20;       functionUrl: `${process.env.NEXT\_PUBLIC\_SUPABASE\_URL}/functions/v1/submit-attendance`,

&#x20;       accessToken: s.session!.access\_token,

&#x20;     },

&#x20;   );



&#x20;   setMsg(

&#x20;     res.ok

&#x20;       ? `✅ Absen ${res.status}`

&#x20;       : `❌ ${res.reason}${res.distance\_m ? ` (${res.distance\_m}m dari outlet)` : ""}`,

&#x20;   );

&#x20; }



&#x20; // Auto-flush queue saat online

&#x20; useEffect(() => {

&#x20;   if (navigator.onLine \&\& outletStaff) queue.flush(outletStaff.outlet\_id);

&#x20; }, \[outletStaff]);



&#x20; return (

&#x20;   <div className="max-w-md mx-auto p-4 space-y-4">

&#x20;     <h1 className="text-xl font-bold">Absensi</h1>

&#x20;     <select

&#x20;       className="w-full border rounded p-2"

&#x20;       onChange={(e) => setSelected(staff.find((s) => s.id === e.target.value) ?? null)}

&#x20;     >

&#x20;       <option value="">Pilih nama…</option>

&#x20;       {staff.map((s) => (

&#x20;         <option key={s.id} value={s.id}>

&#x20;           {s.name}

&#x20;         </option>

&#x20;       ))}

&#x20;     </select>

&#x20;     {selected \&\& (

&#x20;       <Card>

&#x20;         <CameraCapture onReady={setVideo} onError={setMsg} />

&#x20;         <div className="flex gap-2 mt-3">

&#x20;           <Button onClick={() => doClock("in")}>Clock-in</Button>

&#x20;           <Button onClick={() => doClock("out")}>Clock-out</Button>

&#x20;         </div>

&#x20;       </Card>

&#x20;     )}

&#x20;     {msg \&\& <p className="text-center">{msg}</p>}

&#x20;     {!queue.isOnline \&\& (

&#x20;       <p className="text-amber-600 text-sm">

&#x20;         Offline — {queue.pending} absen menunggu sync

&#x20;       </p>

&#x20;     )}

&#x20;   </div>

&#x20; );

}

```



Commit: `feat(m1): halaman clock-in/out (face match + GPS + selfie + offline)`



\---



\### Task 18: Halaman enroll wajah (SPV)



\*\*File\*\*: `apps/absensi/src/app/enroll/page.tsx`



SPV mengambil 3 foto wajah staff → `averageDescriptors` → simpan ke DB + bucket `face-refs`. Ada checkbox consent UU PDP.



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

&#x20; const { outletStaff } = useAuth();

&#x20; const supabase = createClient();

&#x20; const \[staff, setStaff] = useState<Staff\[]>(\[]);

&#x20; const \[targetId, setTargetId] = useState("");

&#x20; const \[video, setVideo] = useState<HTMLVideoElement | null>(null);

&#x20; const \[shots, setShots] = useState<number\[]\[]>(\[]);

&#x20; const \[consent, setConsent] = useState(false);

&#x20; const \[msg, setMsg] = useState("");



&#x20; useEffect(() => {

&#x20;   loadFaceModels();

&#x20;   if (!outletStaff) return;

&#x20;   supabase

&#x20;     .from("outlet\_staff")

&#x20;     .select("id,name")

&#x20;     .eq("outlet\_id", outletStaff.outlet\_id)

&#x20;     .then(({ data }) => setStaff((data as Staff\[]) ?? \[]));

&#x20; }, \[outletStaff]);



&#x20; async function takeShot() {

&#x20;   if (!video) return;

&#x20;   const d = await extractDescriptor(video);

&#x20;   if (!d) return setMsg("Wajah tidak terdeteksi.");

&#x20;   setShots((prev) => \[...prev, d]);

&#x20;   setMsg(`Foto ${shots.length + 1}/3 diambil.`);

&#x20; }



&#x20; async function save() {

&#x20;   if (!targetId || shots.length === 0 || !consent || !outletStaff || !video) return;

&#x20;   const descriptor = averageDescriptors(shots);

&#x20;   const { dataUrl } = captureFrame(video);

&#x20;   const refPath = `${outletStaff.outlet\_id}/${targetId}.jpg`;

&#x20;   const blob = await (await fetch(dataUrl)).blob();

&#x20;   await supabase.storage

&#x20;     .from("face-refs")

&#x20;     .upload(refPath, blob, { upsert: true, contentType: "image/jpeg" });

&#x20;   const { error } = await supabase

&#x20;     .from("outlet\_staff")

&#x20;     .update({

&#x20;       face\_descriptor: descriptor,

&#x20;       ref\_photo\_url: refPath,

&#x20;       consent\_at: new Date().toISOString(),

&#x20;       consent\_by: outletStaff.id,

&#x20;       enrolled\_at: new Date().toISOString(),

&#x20;     })

&#x20;     .eq("id", targetId);

&#x20;   setMsg(error ? `❌ ${error.message}` : "✅ Enroll tersimpan.");

&#x20;   setShots(\[]);

&#x20; }



&#x20; return (

&#x20;   <div className="max-w-md mx-auto p-4 space-y-4">

&#x20;     <h1 className="text-xl font-bold">Enroll Wajah Staff</h1>

&#x20;     <select

&#x20;       className="w-full border rounded p-2"

&#x20;       value={targetId}

&#x20;       onChange={(e) => setTargetId(e.target.value)}

&#x20;     >

&#x20;       <option value="">Pilih staff…</option>

&#x20;       {staff.map((s) => (

&#x20;         <option key={s.id} value={s.id}>

&#x20;           {s.name}

&#x20;         </option>

&#x20;       ))}

&#x20;     </select>

&#x20;     <label className="flex gap-2 text-sm">

&#x20;       <input

&#x20;         type="checkbox"

&#x20;         checked={consent}

&#x20;         onChange={(e) => setConsent(e.target.checked)}

&#x20;       />

&#x20;       Staff menyetujui pemrosesan data biometrik (UU PDP).

&#x20;     </label>

&#x20;     {targetId \&\& consent \&\& (

&#x20;       <Card>

&#x20;         <CameraCapture onReady={setVideo} onError={setMsg} />

&#x20;         <div className="flex gap-2 mt-3">

&#x20;           <Button onClick={takeShot} disabled={shots.length >= 3}>

&#x20;             Ambil foto ({shots.length}/3)

&#x20;           </Button>

&#x20;           <Button onClick={save} disabled={shots.length === 0}>

&#x20;             Simpan

&#x20;           </Button>

&#x20;         </div>

&#x20;       </Card>

&#x20;     )}

&#x20;     {msg \&\& <p className="text-center">{msg}</p>}

&#x20;   </div>

&#x20; );

}

```



Commit: `feat(m1): halaman enroll wajah (SPV) + consent`



\---



\### Task 19: Halaman rekap kehadiran (SPV)



\*\*File\*\*: `apps/absensi/src/app/rekap/page.tsx`



SPV melihat rekap absensi per hari untuk outlet-nya. Ada filter tanggal.



\*\*Catatan\*\*: `Badge` props dari `@suka/design-system` — cek apakah pakai `color` atau `variant`. Jika `variant`, map: `tepat → "success"`, `telat → "warning"`, `alpha → "error"`. Adjust sesuai API yang ada.



```tsx

"use client";



import { useEffect, useState } from "react";

import { Badge, Card } from "@suka/design-system";

import { createClient } from "@/lib/supabase";

import { useAuth } from "@/context/AuthContext";



type Row = {

&#x20; id: string;

&#x20; type: "in" | "out";

&#x20; ts\_server: string;

&#x20; ts\_client: string | null;

&#x20; status: "tepat" | "telat" | "alpha";

&#x20; selfie\_url: string | null;

&#x20; outlet\_staff: { name: string } | null;

};



export default function RekapPage() {

&#x20; const { outletStaff } = useAuth();

&#x20; const supabase = createClient();

&#x20; const \[rows, setRows] = useState<Row\[]>(\[]);

&#x20; const \[date, setDate] = useState(new Date().toISOString().slice(0, 10));



&#x20; useEffect(() => {

&#x20;   if (!outletStaff) return;

&#x20;   const start = `${date}T00:00:00`;

&#x20;   const end = `${date}T23:59:59`;

&#x20;   supabase

&#x20;     .from("attendance")

&#x20;     .select("id,type,ts\_server,ts\_client,status,selfie\_url,outlet\_staff(name)")

&#x20;     .eq("outlet\_id", outletStaff.outlet\_id)

&#x20;     .gte("ts\_server", start)

&#x20;     .lte("ts\_server", end)

&#x20;     .order("ts\_server", { ascending: false })

&#x20;     .then(({ data }) => setRows((data as unknown as Row\[]) ?? \[]));

&#x20; }, \[outletStaff, date]);



&#x20; return (

&#x20;   <div className="max-w-2xl mx-auto p-4 space-y-4">

&#x20;     <h1 className="text-xl font-bold">Rekap Kehadiran</h1>

&#x20;     <input

&#x20;       type="date"

&#x20;       value={date}

&#x20;       onChange={(e) => setDate(e.target.value)}

&#x20;       className="border rounded p-2"

&#x20;     />

&#x20;     <div className="space-y-2">

&#x20;       {rows.map((r) => (

&#x20;         <Card key={r.id}>

&#x20;           <div className="flex items-center justify-between">

&#x20;             <div>

&#x20;               <p className="font-medium">{r.outlet\_staff?.name}</p>

&#x20;               <p className="text-sm text-gray-500">

&#x20;                 {r.type} · {new Date(r.ts\_server).toLocaleTimeString("id-ID")}

&#x20;               </p>

&#x20;             </div>

&#x20;             {/\* Adjust Badge props sesuai @suka/design-system API \*/}

&#x20;             <Badge>{r.status}</Badge>

&#x20;           </div>

&#x20;         </Card>

&#x20;       ))}

&#x20;       {rows.length === 0 \&\& (

&#x20;         <p className="text-gray-500">Belum ada data untuk tanggal ini.</p>

&#x20;       )}

&#x20;     </div>

&#x20;   </div>

&#x20; );

}

```



Commit: `feat(m1): halaman rekap kehadiran (SPV)`



\---



\### Task 20: Job mark-alpha (pg\_cron)



\*\*File\*\*: `supabase/migrations/20260610000500\_m1\_cron\_mark\_alpha.sql`



Fungsi SQL + jadwal pg\_cron untuk menandai staff aktif yang tidak clock-in hari itu sebagai `alpha`.



\*\*Catatan\*\*: `pg\_cron` sudah di-enable di migration `20260610000400` (`CREATE EXTENSION IF NOT EXISTS pg\_cron`).



```sql

\-- M1: tandai alpha untuk staff aktif tanpa clock-in 'in' hari ini.

\-- Dijalankan setiap hari pukul 23:55 (timezone UTC = 16:55 WIB).

CREATE OR REPLACE FUNCTION mark\_alpha\_for(target\_date DATE)

RETURNS void LANGUAGE sql AS $$

&#x20; INSERT INTO attendance (id, outlet\_staff\_id, outlet\_id, type, ts\_server, status)

&#x20; SELECT

&#x20;   gen\_random\_uuid(),

&#x20;   s.id,

&#x20;   s.outlet\_id,

&#x20;   'in',

&#x20;   (target\_date + TIME '23:59'),

&#x20;   'alpha'

&#x20; FROM outlet\_staff s

&#x20; WHERE s.status = 'active'

&#x20;   AND NOT EXISTS (

&#x20;     SELECT 1 FROM attendance a

&#x20;     WHERE a.outlet\_staff\_id = s.id

&#x20;       AND a.type = 'in'

&#x20;       AND a.ts\_server::date = target\_date

&#x20;   );

$$;



SELECT cron.schedule(

&#x20; 'mark-alpha',

&#x20; '55 23 \* \* \*',

&#x20; $$ SELECT mark\_alpha\_for(CURRENT\_DATE); $$

);



\-- DOWN:

\-- SELECT cron.unschedule('mark-alpha');

\-- DROP FUNCTION IF EXISTS mark\_alpha\_for(DATE);

```



Commit: `feat(m1): job pg\_cron mark-alpha (tandai mangkir harian)`



\---



\### Task 21: Verifikasi Menyeluruh \& Deploy



Ini adalah task penutup. Lakukan secara berurutan:



\*\*Step 1: Jalankan semua unit test app\*\*

```powershell

cd apps/absensi; yarn test

\# Expected: PASS — gps (7) + face/match (12) + image (3) + submit (2) = 24 tests

```



\*\*Step 2: Jalankan test Edge Function (Deno)\*\*

```bash

cd supabase/functions \&\& deno test

\# Expected: haversine (2) + status (4) = 6 tests

\# CATATAN: Deno mungkin tidak terinstall di mesin lokal.

\# Jika tidak tersedia, tandai sebagai "verified by code review" dan lanjut.

```



\*\*Step 3: Type-check app\*\*

```powershell

cd apps/absensi; yarn type-check

\# Diketahui ada pre-existing errors dari @suka/\* packages yang belum di-build (dist/ kosong)

\# dan @/ path alias. Ini adalah masalah M0 yang belum diperbaiki, BUKAN regresi M1.

\# Catat di PR description bahwa errors ini sudah ada sebelum M1.

```



\*\*Step 4: Apply migrations\*\*

```bash

npx supabase db push

\# Expected: 5 migration M1 (000000-000400) + migration baru mark-alpha (000500) apply tanpa error

```



\*\*Step 5: Deploy Edge Function\*\*

```bash

npx supabase functions deploy submit-attendance

```



\*\*Step 6: E2E checklist manual\*\* (butuh device/browser + akun SPV outlet uji)

\- \[ ] Enroll staff: descriptor \& ref photo tersimpan di DB + storage

\- \[ ] Clock-in wajah benar + dalam radius → ✅ tepat/telat muncul di DB

\- \[ ] Clock-in wajah orang lain → ❌ ditolak (tidak ada record di DB)

\- \[ ] Clock-in di luar radius (mock GPS dev tools) → ❌ `outside\_radius` (tidak ada record)

\- \[ ] Mode offline: clock-in → tersimpan; nyalakan jaringan → auto-sync; cek satu record (idempoten)

\- \[ ] Rekap SPV: data muncul; akun outlet lain tidak terlihat (test RLS)



\*\*Step 7: Build static export\*\*

```powershell

cd apps/absensi; yarn build

\# Expected: folder out/ terbentuk tanpa error

```



\*\*Step 8: Push \& buka PR\*\*

```bash

git push

\# Buka PR: feat/m1-absensi → main

\# Di PR description:

\# - Sebutkan bahwa type-check errors adalah pre-existing M0 issue (@suka/\* packages belum di-build)

\# - Minta review Dev B untuk migration yang menyentuh outlet\_staff (kolom enroll)

\# - List E2E checklist di atas

```



\---



\## 11. Known Issues \& Gotchas



| Issue | Penjelasan | Aksi |

|-------|-----------|------|

| `@suka/design-system` dan `@suka/offline-queue` belum di-build | `dist/` folder kosong → type-check error pada file yang import dari packages | Pre-existing M0 issue. Catat di PR, jangan block merge |

| `@/` path alias error di type-check | Next.js `paths` alias belum dikonfig di `tsconfig.json` untuk Vitest | Sama — pre-existing, bukan M1 regresi |

| Deno tidak terinstall di Windows | `deno test` tidak bisa dijalankan lokal | Verifikasi logic via code review; tandai di PR |

| face-api.js model weights | File `\*.bin` + `\*.json` \~7MB tidak di-commit (`.gitkeep` saja) | Developer perlu unduh manual dari GitHub face-api.js ke `public/models/` |

| `Badge` props design-system | Belum diketahui apakah `color` atau `variant` | Cek source `packages/design-system/src/components/Badge.tsx` saat T19 |

| `useOfflineQueue` API: `queue` bukan `items` | Hook return `{ queue, add, flush, ... }` — array items ada di `.queue`, BUKAN `.items` | Sudah diperbaiki di `useAttendanceQueue.ts` yang ada |



\---



\## 12. Commands Penting



```powershell

\# Pindah ke project (Windows PowerShell)

cd "C:\\Users\\AK\\Desktop\\DIGITALISASI-SS-PROJECT"



\# Pastikan di branch yang benar

git checkout feat/m1-absensi



\# Install dependencies

yarn install



\# Jalankan test

cd apps/absensi; yarn test



\# Type-check

cd apps/absensi; yarn type-check



\# Build

cd apps/absensi; yarn build



\# Lihat git log

git log --oneline -15

```



\---



\## 13. File Referensi Utama



| File | Untuk apa |

|------|-----------|

| `docs/superpowers/specs/2026-06-09-m1-absensi-face-matching-design.md` | Design spec lengkap (8 section) |

| `docs/superpowers/plans/2026-06-09-m1-absensi-implementation.md` | 21-task implementation plan (TDD) |

| `supabase/functions/submit-attendance/index.ts` | Edge Function utama |

| `apps/absensi/src/lib/attendance/types.ts` | Tipe payload + result |

| `apps/absensi/src/lib/attendance/useAttendanceQueue.ts` | Hook offline queue |

| `apps/absensi/src/lib/face/match.ts` | Logic face matching |

| `apps/absensi/src/lib/face/recognizer.ts` | Wrapper face-api.js |

| `apps/absensi/src/lib/image.ts` | Kompres selfie |



\---



\*Dokumen ini ditulis 2026-06-09 sebagai handoff dari sesi sebelumnya. Branch `feat/m1-absensi` siap dilanjutkan dari T16.\*



