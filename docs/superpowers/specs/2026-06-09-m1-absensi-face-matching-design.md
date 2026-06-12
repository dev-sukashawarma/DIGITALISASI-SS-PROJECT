# Design — M1: Absensi Outlet + Face Matching

> Status: Disetujui (2026-06-09) · Track: Dev A · Modul: M1 (prioritas #1)
> Terkait: [`docs/PRD.md`](../../PRD.md) §M1 · [`docs/ARCHITECTURE.md`](../../ARCHITECTURE.md) · [`docs/FLOWS.md`](../../FLOWS.md) · ADR-003, ADR-004, ADR-005

## 1. Ringkasan & Keputusan Brainstorming

M1 = absensi staff outlet anti titip-absen di device bersama (HP/tablet Android, satu per outlet). Tiga lapis anti-curang: **face match 1:1 (client)** + **GPS radius (server)** + **selfie audit + timestamp server**.

Keputusan yang diambil saat brainstorming:

1. **Dependensi M0:** M0 (`outlet_staff`, `outlets`, auth/RLS, design-system) dikerjakan tim lain. M1 mengonsumsi kontraknya — bangun langsung tanpa mock.
2. **Auth & sesi:** device login sekali sebagai "akun outlet" (sesi panjang, JWT membawa `outlet_id`). Saat clock-in, staff **pilih nama** lalu **wajah memverifikasi 1:1** (sesuai ADR-003).
3. **Offline:** online-first + queue ringan (IndexedDB). Bukan PWA penuh. Load awal butuh online (model & aset), absen tersimpan di antrian saat offline & auto-sync.
4. **Shift & status:** jam kerja sederhana per outlet (satu `jam_masuk` + toleransi). Tanpa rotasi shift. `alpha` ditandai job harian.
5. **Scope MVP:** clock-in/out + face + GPS, enroll wajah oleh SPV, rekap kehadiran SPV, consent + retensi selfie. Keempatnya masuk.
6. **Jalur tulis absen:** **Edge Function `submit-attendance`** (pendekatan B) — server otoritatif untuk validasi radius GPS, timestamp, dan status. Face match tetap client-side.

## 2. Arsitektur & Komponen

App `apps/absensi` — Next.js static export (`output: 'export'`), Tailwind, import `packages/design-system`. Deploy ke `absensi.sukashawarma.*` (cPanel static). Tiga area di satu app dibagi per route + role.

```
apps/absensi/
├── app/
│   ├── (auth)/login/          login "akun outlet" (sesi panjang)
│   ├── (device)/clock/        layar crew: clock-in/out (default device outlet)
│   ├── (spv)/enroll/          SPV: enroll wajah staff
│   └── (spv)/rekap/           SPV: rekap kehadiran + spot-check selfie
├── lib/
│   ├── supabase.ts            client (anon key + RLS + sesi)
│   ├── face/                  wrapper face-api.js (load model, descriptor, match 1:1)
│   ├── gps.ts                 ambil koordinat client (UX; validasi final di server)
│   ├── queue/                 IndexedDB: antrian absen + cache descriptor staff
│   └── attendance.ts          panggil Edge Function submit-attendance + replay queue
└── public/models/             model face-api.js (tiny_face_detector + landmark + recognition)
```

| Unit | Tugas | Bergantung pada |
|------|-------|-----------------|
| `lib/face` | load model, descriptor[128], match 1:1 (euclidean < threshold ≈0.5) | face-api.js, `/public/models` |
| `lib/queue` | cache descriptor staff + antrian absen di IndexedDB | IndexedDB |
| `lib/attendance` | bungkus payload, panggil Edge Function, replay antrian saat online | `lib/queue`, `lib/supabase` |
| Edge Function `submit-attendance` | validasi GPS radius + stempel `ts_server` + tentukan status + insert | `outlets`, `outlet_attendance_config`, `attendance` |
| Edge Function `cleanup-selfies` (pg_cron) | hapus selfie audit > retensi (90 hari) | Storage, `attendance` |
| Job `mark-alpha` (pg_cron) | tandai staff aktif tanpa clock-in harian = `alpha` | `attendance`, `outlet_staff` |

**Pembagian server vs client:**
- **Client:** kamera live, hitung descriptor, **match wajah 1:1** (descriptor di-cache lokal), ambil GPS (UX/preview), upload selfie ke Storage, antri offline.
- **Server (Edge Function):** otoritas final — hitung jarak GPS dari `outlets.lat/lng`, stempel `ts_server`, tentukan `status`, insert `attendance`. Idempoten via UUID client.

## 3. Skema Data

Semua tabel baru di project **Outlet Suite**, RLS per-outlet, migration additive + DOWN. `outlets` & `outlet_staff` disediakan M0; kolom enroll ditambah lewat migration M1 bila M0 belum menyediakannya.

### 3.1 `attendance`
```
id              uuid PK        -- digenerate CLIENT (idempotency key untuk replay queue)
outlet_staff_id uuid FK -> outlet_staff
outlet_id       uuid FK -> outlets
type            text           -- 'in' | 'out'
ts_server       timestamptz    -- diisi SERVER (now())
ts_client       timestamptz    -- waktu device saat absen (audit; basis telat bila offline)
gps_lat         numeric
gps_lng         numeric
distance_m      numeric        -- jarak ke outlet, dihitung server
match_distance  numeric        -- euclidean dari client (audit kualitas match)
selfie_url      text           -- path di Storage
status          text           -- 'tepat' | 'telat' | 'alpha'
created_at      timestamptz default now()
UNIQUE(id)                     -- insert idempoten; replay tak menggandakan
```

### 3.2 `outlet_attendance_config`
Config jam kerja & radius per outlet — terpisah dari `outlets` yang read-only/synced dari Ecosystem.
```
outlet_id        uuid PK FK -> outlets
jam_masuk        time            -- mis. 09:00
toleransi_menit  int default 15
radius_m         int default 100 -- radius GPS sah (75–100m)
updated_at       timestamptz
```

### 3.3 Kolom enroll di `outlet_staff` (additive via migration M1 bila belum ada)
```
face_descriptor  jsonb       -- vektor[128] (rata-rata 1–3 foto)
ref_photo_url    text        -- foto referensi enroll
consent_at       timestamptz -- waktu consent biometrik (UU PDP)
consent_by       uuid        -- SPV yang melakukan enroll
enrolled_at      timestamptz
```

### 3.4 Storage buckets (RLS per-outlet)
- `selfies/<outlet_id>/<uuid>.jpg` — selfie audit clock-in (retensi 90 hari, auto-hapus).
- `face-refs/<outlet_id>/<staff_id>.jpg` — foto referensi enroll (retensi mengikuti masa kerja staff).

### 3.5 Penentuan status
- `type='in'`: `basis_telat > (jam_masuk + toleransi_menit)` → `telat`, else `tepat`. `basis_telat` = `ts_server` (online) atau `ts_client` (dari antrian offline).
- `alpha`: bukan hasil clock-in. Job harian `mark-alpha` (pg_cron) menandai staff aktif yang tak punya record `in` hari itu.

### 3.6 RLS
Semua tabel: baca/tulis hanya bila `outlet_id` cocok dengan `outlet_id` di JWT akun outlet. Uji wajib: outlet X tak bisa baca/tulis data outlet Y.

## 4. Data Flow

### 4.1 Enroll wajah (SPV)
```
SPV login akun outlet → /enroll → pilih staff outlet itu
  → layar CONSENT biometrik (UU PDP), SPV + staff setujui
  → kamera ambil 1–3 foto → face-api.js hitung descriptor tiap foto
  → rata-ratakan jadi 1 descriptor[128]
  → upload foto referensi ke Storage face-refs/
  → UPDATE outlet_staff SET face_descriptor, ref_photo_url,
           consent_at=now(), consent_by=SPV, enrolled_at=now()
```
Tanpa enroll, staff tak muncul sebagai "siap absen" di layar clock.

### 4.2 Clock-in/out (crew)
```
/clock → load descriptor semua staff outlet (cache IndexedDB)
  → staff pilih nama → kamera live
  → face-api.js descriptor live → MATCH 1:1 vs descriptor staff itu
       jarak ≥ threshold (≈0.5) → ❌ "wajah tidak cocok" (stop)
       jarak < threshold        → lanjut
  → ambil GPS + capture selfie → upload selfie ke Storage selfies/
  → ONLINE?
       ya    → panggil Edge Function submit-attendance (§5)
       tidak → simpan ke antrian IndexedDB (payload + UUID + selfie blob)
  → tampilkan hasil: ✅ tepat/telat  atau  ❌ ditolak (di luar radius)
```
Face match & GPS diambil client untuk UX; keputusan sah/tidak (radius) + timestamp + status difinalkan server.

### 4.3 Offline replay
```
saat online kembali (atau interval) → lib/attendance flush antrian:
  per item: upload selfie tertunda → panggil submit-attendance (UUID sama, from_queue=true)
  sukses → hapus dari antrian
  UNIQUE(id) → replay ganda tidak menggandakan record
```
Konsekuensi: untuk absen offline, `ts_server` = waktu **sync**, bukan waktu absen. `ts_client` (waktu device saat absen) disimpan; status telat absen offline dihitung dari `ts_client`. Server tetap stempel `ts_server` sebagai jejak waktu terima. SPV bisa lihat selisih ts_client vs ts_server di rekap.

### 4.4 Retensi selfie (pg_cron)
```
harian: cleanup-selfies → hapus objek Storage selfies/ untuk
        attendance.ts_server < now() - 90 hari, kosongkan selfie_url
```

### 4.5 Rekap SPV
```
/rekap → query attendance per outlet (RLS) by tanggal/staff
  → tabel: nama, type, jam, status (tepat/telat/alpha), thumbnail selfie, selisih ts_client/ts_server
  → klik selfie → preview besar (spot-check titip-absen)
```

## 5. Kontrak Edge Function `submit-attendance`

Dipanggil dengan JWT akun outlet. Function membaca `outlet_id` dari JWT, **tidak percaya `outlet_id` dari body**.

**Request body:**
```jsonc
{
  "id": "uuid",              // digenerate client (idempotency key)
  "outlet_staff_id": "uuid",
  "type": "in",             // "in" | "out"
  "gps_lat": -6.21,
  "gps_lng": 106.84,
  "match_distance": 0.38,    // euclidean dari face match client (audit)
  "selfie_path": "selfies/<outlet_id>/<uuid>.jpg",  // sudah diupload client
  "ts_client": "2026-06-09T09:03:00+07:00",
  "from_queue": false        // true bila replay offline
}
```

**Logika (urut):**
```
1. authz   : outlet_id ← JWT. Tolak bila tak ada sesi (401).
2. validasi: outlet_staff_id milik outlet_id → else 403
             face_descriptor staff ter-enroll → else 422 "belum enroll"
             selfie_path berprefix "selfies/<outlet_id>/" → else 403
3. lokasi  : ambil outlets.lat/lng + config.radius_m
             distance_m = haversine(gps, outlet)
             distance_m > radius_m → 200 {ok:false, reason:"outside_radius", distance_m}
             (TIDAK insert; absen tak sah)
4. waktu   : ts_server = now()
             basis_telat = from_queue ? ts_client : ts_server
             status = basis_telat > (jam_masuk + toleransi_menit) ? "telat" : "tepat"
5. insert  : INSERT attendance (...) ON CONFLICT (id) DO NOTHING   // idempoten
6. return  : 200 {ok:true, status, distance_m, ts_server, attendance_id}
```

**Response sukses:** `{ "ok": true, "status": "tepat", "distance_m": 42, "ts_server": "...", "attendance_id": "uuid" }`
**Response ditolak radius:** `{ "ok": false, "reason": "outside_radius", "distance_m": 320 }`

**Properti:**
- **Idempoten** — `ON CONFLICT (id) DO NOTHING`; replay offline aman.
- **Server-authoritative** — radius, ts_server, status tak bisa dipalsukan client.
- **Match wajah tetap di client** — function hanya menyimpan `match_distance` untuk audit; descriptor tidak dikirim ke server (hemat & privasi, sesuai ADR-003).
- **Validasi path selfie** — cegah tulis lintas-outlet.

## 6. Error Handling & Edge Cases

| Situasi | Penanganan |
|---------|-----------|
| Izin kamera ditolak | Blokir clock-in, instruksi aktifkan kamera |
| Izin GPS ditolak | Blokir clock-in (radius wajib), instruksi aktifkan lokasi |
| Wajah tak terdeteksi | Retry dengan panduan, tak kirim |
| Match ≥ threshold | ❌ tolak di client, tak ada panggilan server |
| Staff belum enroll | Tak muncul di daftar; bila dipaksa → server 422 |
| Di luar radius GPS | Server balas `outside_radius` + jarak; absen tidak tersimpan |
| Offline saat absen | Masuk antrian IndexedDB + selfie blob; badge "x absen menunggu sync" |
| Sync gagal (5xx) | Tetap di antrian, retry backoff; tak hapus sampai 200 |
| Double clock-in (replay/2x tekan) | `ON CONFLICT(id) DO NOTHING` → idempoten |
| Clock-out tanpa clock-in | Diizinkan (catat); rekap tandai anomali, tak blokir |
| Selfie gagal upload | Antrian simpan blob; sync upload dulu, baru function |
| Model face-api gagal load | Banner error, clock-in disabled sampai siap (online-first) |
| Sesi akun outlet kedaluwarsa | Redirect login; antrian offline tetap aman di IndexedDB |
| Jam device dimanipulasi (offline) | `ts_client` audit; SPV lihat selisih ts_client vs ts_server |

**Threat model diterima (MVP, ADR-003):** foto-dari-foto masih mungkin (liveness ditunda) → dimitigasi kamera live + GPS radius + selfie audit untuk spot-check SPV. Keterbatasan sadar, bukan bug.

## 7. Testing

**Unit (Vitest):**
- `lib/face`: descriptor sama < threshold (terima), beda ≥ threshold (tolak); kalibrasi threshold.
- `gps/haversine`: titik dekat < radius, titik jauh > radius.
- `lib/queue`: enqueue/dequeue, idempotency UUID, persist IndexedDB (fake-indexeddb).

**Edge Function (Deno test):**
- outlet_id dari JWT, body `outlet_id` diabaikan.
- di luar radius → `outside_radius`, tak insert.
- status `telat` saat lewat `jam_masuk+toleransi`; `tepat` saat sebelum.
- `from_queue` → status pakai `ts_client`.
- replay UUID sama → satu record (ON CONFLICT).
- staff belum enroll → 422; staff outlet lain → 403.

**RLS (integration):** outlet X tak bisa baca/tulis `attendance` outlet Y; selfie path lintas-outlet ditolak.

**Manual/E2E (Verifikasi PRD §M1):** enroll staff → wajah benar match → wajah lain ditolak → di luar GPS ditolak → offline tersimpan & sinkron → selfie audit muncul di rekap SPV.

## 8. Asumsi & Kontrak dari M0 (perlu dikonfirmasi ke Dev B)

- `outlet_staff(id, outlet_id, name, role, status)` tersedia; M1 menambah kolom enroll bila belum ada.
- `outlets(id, slug, name, lat, lng, is_active)` tersedia & ter-sync (uuid sama dengan Ecosystem).
- Mekanisme auth: JWT akun outlet membawa `outlet_id` (custom claim) yang dipakai RLS & Edge Function.
- `packages/design-system` (token SUKA) tersedia sebagai dependency.
- Pola offline-queue reusable dari M0 — bila ada, M1 pakai; bila tidak, `lib/queue` jadi milik M1.

## 9. Out of Scope (ditunda)
- Liveness aktif (kedip/gerak).
- Payroll/penggajian outlet.
- Rotasi shift / penjadwalan kompleks.
- PWA penuh / offline-first dengan service worker.
