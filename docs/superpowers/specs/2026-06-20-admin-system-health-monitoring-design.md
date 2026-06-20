# Admin-Dashboard — System Health Monitoring (Design)

**Date:** 2026-06-20
**App:** `apps/admin-dashboard` (+ endpoint baru di `stok`, `absensi`, `pos-kasir`, `distribusi`, `owner-dashboard`)
**Status:** Design approved, pending implementation plan
**Depends on:** Admin-Dashboard Fase 1 & 2 (shell, auth guard, sidebar) sudah ada.

---

## 1. Goal & Scope

Admin sebagai super user butuh visibility cepat: **apakah semua app & infra sehat lintas 19 outlet**, tanpa harus buka tiap subdomain satu-satu atau cek cPanel manual. Dashboard ini murni **monitoring + diagnostics read-only** — tidak ada remote action (restart/toggle) di fase ini.

**In scope:**
- Health check per app (`stok`, `absensi`, `pos-kasir`, `distribusi`, `owner-dashboard`): reachability, koneksi database, last data activity (global, bukan per-outlet), response time.
- Health check Supabase (REST reachability + latency).
- Health check cPanel server (disk space, uptime) — **opsional**, aktif hanya jika token UAPI tersedia; tidak block fitur lain jika belum ada.
- Histori/insiden: deteksi transisi status (up→down, up→degraded) dari log, tampilkan sebagai daftar ringkas 24 jam terakhir.
- Halaman baru: `/dashboard/system-health` di admin-dashboard.

**Out of scope (eksplisit):**
- **Remote action** (restart service, toggle feature flag, trigger sync) — admin masih harus hubungi tech team manual kalau ada masalah. Bisa jadi fase lanjutan.
- **Per-outlet breakdown** untuk last activity — last activity dihitung global per app (lintas semua outlet), bukan per outlet individual. Detail per-outlet sudah ada di app masing-masing (misal `monitoring-live` di stok).
- **Threshold otomatis untuk last activity** — last activity ditampilkan sebagai info read-only ("terakhir 2 jam lalu"), TIDAK menentukan warna status. Status (up/degraded/down) murni dari reachability + db connection.
- **cPanel disk/uptime monitoring** jika akses UAPI token belum dikonfirmasi tersedia di hosting connectindo — modul ini di-skip secara graceful, ditampilkan sebagai "belum dikonfigurasi" tanpa error.
- **Realtime push notification** (WhatsApp/email alert saat down) — dashboard ini pull-based (admin buka halaman untuk lihat status), bukan push alert.

---

## 2. Arsitektur

```
┌─────────────────────────────────────────────────┐
│  Collector (Supabase Edge Function)              │
│  Trigger: pg_cron setiap 5 menit                 │
│                                                    │
│  Untuk tiap target:                              │
│  - 5 app endpoints (GET /api/health per subdomain)│
│  - Supabase REST self-check                      │
│  - cPanel UAPI (skip jika token tidak ada)       │
│                                                    │
│  → tulis 1 row per target ke system_health_log    │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  apps/admin-dashboard                             │
│  /dashboard/system-health                         │
│  Query system_health_log (read-only)              │
│  Client refetch interval 30s (React Query)        │
└─────────────────────────────────────────────────┘
```

**Kenapa cron + tabel, bukan polling langsung dari client (lihat alternatif yang dipertimbangkan):**
- Dashboard load cepat — tidak nunggu 5 app + Supabase + cPanel respons saat halaman dibuka.
- Decoupled — satu app down tidak bikin dashboard ikut lambat/error.
- Ada histori untuk deteksi insiden ("down dari jam berapa"), bukan cuma snapshot sekarang.
- Konsisten dengan pola existing: SPV monitoring (`monitoring_view_spv`) juga baca dari view/tabel agregat, bukan live-query cross-outlet langsung.

### 2.1 Endpoint baru per app

Tiap app (`stok`, `absensi`, `pos-kasir`, `distribusi`, `owner-dashboard`) tambah:

```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "db": "ok",
  "lastActivity": "2026-06-20T14:32:00Z",
  "responseTimeMs": 42
}
```

- `status`: `"ok"` jika endpoint reachable dan tidak exception.
- `db`: `"ok"` | `"error"` — hasil query ringan (`select 1` atau setara) ke Supabase dari app tersebut.
- `lastActivity`: timestamp transaksi/data terakhir, query ke tabel paling relevan:
  - `stok` → `ledger_stok.created_at` terbaru
  - `absensi` → tabel absensi, `clocked_at` terbaru
  - `pos-kasir` → tabel transaksi terbaru
  - `distribusi` → `surat_jalan` terbaru
  - `owner-dashboard` → tidak relevan (read-only aggregator) — null
- `responseTimeMs`: diukur server-side oleh endpoint itu sendiri (waktu eksekusi query db check), bukan oleh collector (collector catat response time-nya sendiri secara terpisah sebagai total round-trip).

Endpoint ini **publicly reachable tapi tidak expose data sensitif** — hanya status & timestamp agregat, tidak ada PII.

### 2.2 Collector

Implementasi: **Supabase Edge Function** (`supabase/functions/system-health-collector/`), dipanggil oleh `pg_cron` setiap 5 menit.

Logic:
1. Fetch `GET https://<app>.sukashawarma.com/api/health` untuk tiap 5 app, dengan timeout (misal 8s).
2. Fetch Supabase REST root endpoint, ukur latency.
3. Jika env var `CPANEL_UAPI_TOKEN` ada → fetch UAPI disk/uptime. Jika tidak ada → tetap insert 1 row untuk target `cpanel-server` dengan `status: 'unconfigured'` (lihat §3) — bukan skip total, supaya UI tetap punya row terbaru untuk ditampilkan sebagai "belum dikonfigurasi".
4. Insert hasil ke `system_health_log`, satu row per target per run.
5. Tangani fetch gagal (timeout/network error) sebagai `status: 'down'`, bukan exception yang membatalkan seluruh run — tiap target independen (`Promise.allSettled`).

---

## 3. Data Model

Tabel baru: `system_health_log`

```sql
create table system_health_log (
  id bigint generated always as identity primary key,
  target_type text not null,        -- 'app' | 'supabase' | 'cpanel'
  target_name text not null,        -- 'stok' | 'absensi' | 'pos-kasir' | 'distribusi' | 'owner-dashboard' | 'supabase-db' | 'cpanel-server'
  status text not null,             -- 'up' | 'degraded' | 'down' | 'unconfigured'
  db_status text,                   -- 'ok' | 'error' | null (khusus target_type='app')
  last_activity_at timestamptz,     -- null untuk target non-app atau owner-dashboard
  response_time_ms int,
  detail jsonb,                     -- raw error message / response body untuk debugging
  checked_at timestamptz not null default now()
);

create index on system_health_log (target_type, target_name, checked_at desc);
```

**Status derivation (oleh collector, sebelum insert):**
- `down` — fetch gagal / timeout / non-2xx response.
- `degraded` — reachable (2xx) tapi `db_status = 'error'`, ATAU response time melebihi threshold kasar (misal >3000ms) — dicatat tapi threshold response time TIDAK dituning ketat di fase ini (lihat §1 out of scope soal threshold otomatis — ini exception kecil hanya untuk kasus ekstrem, bukan tuning halus).
- `up` — reachable, db ok, response time wajar.
- `unconfigured` — khusus `cpanel-server` ketika token tidak ada. Bukan error, bukan dicoba fetch.

**RLS:** tabel ini hanya dibaca oleh `admin` (dan mungkin `owner` jika nanti relevan). Insert hanya dari service role (collector). Pakai pola `security_invoker=false` + policy `select` terbatas ke role `admin`, konsisten dengan prinsip least-privilege di `CLAUDE.md`.

**Retention:** tidak ada cleanup job di fase ini (data 5-menitan, growth ~288 row/hari/target × 7 target ≈ 2000 row/hari — kecil, tidak perlu partisi/retention policy sekarang).

---

## 4. UI — `/dashboard/system-health`

Route baru di `apps/admin-dashboard`, masuk sidebar nav (sejajar dengan Staff & Outlet).

**Layout:**

```
System Health                              Auto-refresh: 30s

── Apps ──────────────────────────────────────────────
[stok]        [absensi]      [pos-kasir]   [distribusi]  [owner-dashboard]
🟢 up         🟢 up          🟡 degraded   🟢 up          🟢 up
db: ok        db: ok         db: error     db: ok         db: ok
last: 2m lalu last: 5m lalu  last: -       last: 1h lalu  last: n/a

── Infrastructure ────────────────────────────────────
[Supabase]              [cPanel Server]
🟢 up, 45ms             ⚪ belum dikonfigurasi

── Riwayat Insiden (24 jam terakhir) ─────────────────
14:32  pos-kasir DOWN → degraded (durasi turun: 9 menit)
09:15  stok degraded (db_status: error)
```

**Komponen:**
- `AppHealthCard` — status badge (🟢/🟡/🔴), db status, last activity (plain text, no color), response time kecil di corner.
- `InfraHealthCard` — sama tapi untuk Supabase/cPanel; tampil ⚪ "belum dikonfigurasi" untuk `status: 'unconfigured'`.
- `IncidentTimeline` — derive dari `system_health_log`: group by `target_name`, urutkan `checked_at`, deteksi perubahan `status` antar baris berurutan → render sebagai event. Query terbatas ke 24 jam terakhir.

**Data fetching:** React Query, `staleTime` pendek + `refetchInterval: 30_000`. Query langsung ke `system_health_log` (Supabase client, filter `checked_at > now() - interval '1 day'`, order by `checked_at desc`, ambil row terbaru per `target_name` untuk card status + full range untuk incident timeline).

**Empty/error state:** jika `system_health_log` kosong (misal collector belum pernah jalan) → tampilkan empty state "Belum ada data health check" alih-alih card kosong/error.

---

## 5. Testing

- Unit test: fungsi derivasi status (`deriveStatus(reachable, dbStatus, responseTimeMs)`) dan fungsi deteksi transisi insiden (`detectTransitions(logs)`) — pure functions, mudah ditest tanpa mock network.
- Component test: `AppHealthCard`, `InfraHealthCard` render benar untuk tiap kombinasi status.
- Endpoint `/api/health` per app: smoke test manual (curl) setelah deploy — tidak perlu unit test khusus karena logic-nya tipis (query + timestamp).
- Collector (Edge Function): manual invoke + cek row masuk ke `system_health_log` saat development; tidak ada CI test untuk Edge Function di fase ini (konsisten dengan app lain — "No end-to-end tests yet" per `CLAUDE.md`).

---

## 6. Risiko & Dependency Terbuka

1. **cPanel UAPI token** — belum dikonfirmasi tersedia di hosting connectindo. Modul `cpanel-server` didesain graceful-skip; tidak blocking modul lain. Perlu dicek manual ke cPanel (Manage API Tokens) sebelum implementasi modul ini.
2. **CORS antar-subdomain** — endpoint `/api/health` dipanggil dari Edge Function (server-to-server), bukan dari browser, jadi CORS tidak relevan di sini (beda dari pendekatan client-polling yang sempat dipertimbangkan).
3. **pg_cron availability** — perlu konfirmasi extension `pg_cron` aktif di project Supabase (biasanya tersedia di paket Pro+; perlu cek tier project ini).
