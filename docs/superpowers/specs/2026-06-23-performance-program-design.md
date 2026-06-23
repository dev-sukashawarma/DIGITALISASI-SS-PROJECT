# Performance Improvement Program — All Apps

**Date:** 2026-06-23
**Status:** Approved (brainstorm) — pending implementation plan
**Owner:** Dev Suka Shawarma

## Goal

Proaktif audit + hardening performa lintas **7 app** (absensi, admin-dashboard, distribusi, owner-dashboard, portal, pos-kasir, stok), dengan fokus utama **query database**. Tujuan akhir: program berulang (audit → fix → baseline + monitoring) sehingga regresi performa ketahuan ke depannya — bukan sekadar tambal sekali jalan.

**Scope decision (brainstorm):** Full program (audit + fix high-impact + baseline/monitoring). Prioritas: **cross-cutting wins dulu (B), lalu database layer (C)**, baru per-app cleanup. Semua tooling tersedia: Supabase dashboard, direct DB/migrations, app-level instrumentation.

## Non-Goals

- Bukan rewrite arsitektur. Tidak menyentuh distribusi LIVE secara langsung (baseline).
- Tidak menambah infra e2e baru.
- Tidak refactor yang tak melayani tujuan performa.

## Grounding — temuan awal (dari kode)

- **Auth hot path:** `portal/middleware.ts` dan `apps/absensi/src/app/api/checklist/_authorizeOutlet.ts` memanggil `auth.getUser()` (network round-trip ke Supabase) tiap request. `apps/stok/src/lib/queries/monitoring.ts:18,104` memanggil `getUser()` **dua kali**. Fast-path JWT lokal sudah ada di `packages/auth/src/middleware.ts` tapi belum dipakai merata, dan **diam-diam fallback** ke `getUser()` jika `SUPABASE_JWT_SECRET` kosong (lihat memory `portal-nav-perf-jwt-secret`).
- **Over-fetching di JS:** `apps/absensi/src/app/api/outlet-presence/route.ts` menarik *semua* baris attendance 18 jam lalu dedup via loop JS — seharusnya `DISTINCT ON` view / RPC.
- **Index:** coverage bagus di `outlet_staff`, `ledger_stok`, `opname`, `surat_jalan` (19 index di migrations). Perlu verifikasi `attendance` (filter `outlet_id` + `ts_server`) dan tabel face/checklist.
- **N+1 / waterfall suspects:** ~20 file dashboard (chart components admin/owner, `rekap`, `checklist-monitor`, `papan-kehadiran`, `useSuratJalan`).
- **Query surface per app:** absensi 21, distribusi 15, stok 14, admin-dashboard 11, owner-dashboard 7, portal 1, pos-kasir 0.

## Arsitektur Program — 3 fase (+ Fase 0)

Tiap fase shippable independen, urut by return-on-risk.

### Fase 0 — Instrumentation & Baseline (ukur sebelum potong)

- Aktifkan `pg_stat_statements` (migration); dokumentasi cara baca di `docs/PERFORMANCE.md`.
- Util ringan `withTiming(label, fn)` di `@suka/auth` (re-export ke semua app); log `[slow-query] label 412ms` saat > 300ms. Gated `PERF_LOG=1`, zero-overhead saat off.
- Capture baseline: top-20 query (slowest + most-frequent) dari `pg_stat_statements` + per-app TTFB/cold-load ke tabel "Before" di `docs/PERFORMANCE.md`.

### Fase 1 — Cross-cutting wins (satu fix → semua app)

| Fix | File | Win |
|---|---|---|
| Semua middleware lewat JWT lokal; hapus network `getUser()` | `portal/middleware.ts`, `packages/auth/src/middleware.ts` | −1 network RTT/request, tiap app |
| De-dup double `getUser()` | `apps/stok/src/lib/queries/monitoring.ts:18,104` | −1 RTT per monitoring load |
| Warning keras saat `SUPABASE_JWT_SECRET` kosong di prod | `packages/auth/src/middleware.ts` | cegah silent slow fallback |
| Satu Supabase server client per request (verifikasi tak ada client per-komponen) | semua app | lebih sedikit handshake |
| RSC `cache()` + `revalidate` untuk `outlets` / `bahan_baku` / `outlet_staff` | shared data helpers | potong repeat reads |

### Fase 2 — Database layer (mengalir dari temuan Fase 0)

- `EXPLAIN ANALYZE` top-20 Fase 0; tambah index via migration. Kandidat pertama terkonfirmasi: `attendance(outlet_id, ts_server DESC)`.
- Konversi agregasi JS → SQL: `outlet-presence` → `DISTINCT ON` view/RPC; audit sama untuk `rekap`, `checklist-monitor`, komponen chart dashboard.
- Review monitoring views + `accessible_outlet_ids()` untuk seq-scan / re-evaluasi (jaga RLS semantics — view definer tetap bypass RLS untuk cross-outlet).

### Fase 3 — Per-app cleanup & guardrails

- Sweep N+1 / waterfall app-by-app, worst-offender dulu: absensi → distribusi → stok → admin/owner-dashboard. Tiap fix diverifikasi vs timing Fase 0.
- `docs/PERFORMANCE.md`: perf-budget + checklist review ("no `select('*')` di hot path, no `await` di render loop, index tiap kolom filter baru").

## Testing & Verifikasi

- Tiap perubahan DB: `EXPLAIN ANALYZE` before/after dilampirkan di PR.
- Tiap perubahan app: angka before/after dari log `withTiming`.
- Suite vitest existing tetap hijau (perubahan no-behavior-change).
- Tidak ada infra e2e baru.

## Risiko & Mitigasi

- **Migration history drift** (memory `supabase-migration-history-drift`): `migration repair` sebelum `db push`, jangan push polos.
- **RLS regression:** perubahan view/RPC harus pertahankan scope `accessible_outlet_ids()`; uji per-role.
- **Distribusi LIVE:** jangan utak-atik langsung; ikuti baseline + plan re-upload.

## Urutan Eksekusi

Fase 0 → 1 → 2 → 3. Fase 0 wajib lebih dulu (tanpa baseline, "fix" tak terukur).
