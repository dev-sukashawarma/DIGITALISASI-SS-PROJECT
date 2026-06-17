# Distribusi Hardening — Design Spec

> Tanggal: 2026-06-15 · Status: Approved (brainstorming + grill-with-docs) · Owner: Dev Suka Shawarma
> Referensi playbook: pekerjaan hardening `apps/stok` (commit `ad58169`).

## Tujuan

Membawa `apps/distribusi` ke kondisi clean, type-safe, dan auth-consistent yang sama dengan `apps/stok`, sekaligus memperbaiki bug laten yang ditemukan saat audit. Plan ini dipakai sebagai **referensi saat re-upload distribusi ke production** — distribusi yang sekarang LIVE dijadikan baseline referensi, bukan diutak-atik langsung.

## Konteks & Temuan Audit

distribusi hampir kembar dengan kondisi stok sebelum di-fix, plus dua config hazard yang stok tidak punya. Audit (vs playbook stok):

| # | Temuan | Severity | Fix referensi (stok) |
|---|--------|----------|----------------------|
| 1 | `tsconfig.json` tanpa `baseUrl` → `@/*` resolve ke root repo → 16× "Cannot find module" + masking ~20 implicit-`any` | 🔴 High | tambah `"baseUrl": "."` |
| 2 | **61 type-check errors** total | 🔴 High | stok 228→0 |
| 3 | Duplikat next.config (`next.config.js` Jun 10 + `next.config.ts` Jun 15). `.ts` punya `output: 'export'` + key `eslint` invalid (Next 16) | 🔴 High | single clean `.ts` + `ignoreBuildErrors` |
| 4 | Semua hook/komponen pakai `createClient()` lokal yang **tidak** set `cookieDomain` → cookie sesi tidak cross-subdomain | 🟠 Medium (SSO bug laten) | pindah ke `createSupabaseBrowserClient` dari `@suka/auth` |
| 5 | ~10 komponen render `toLocaleDateString('id-ID')` langsung di JSX → hydration/locale mismatch | 🟡 Low-Med | format tanggal di `useEffect` (client-only) |
| 6 | Tidak ada test infra (no vitest/@testing-library) | 🟡 Low | tambah vitest + jest-dom |

### Kontradiksi arsitektur yang di-resolve (grill-with-docs)

`output: 'export'` (static export) bertentangan dengan kenyataan: distribusi LIVE sebagai **Next.js Node server** (CloudLinux Node Selector + Passenger) dan punya `middleware.ts` (`enforceAppAccess`) yang **hanya jalan di server**. ADR-005 (static export) premisnya ("cPanel shared tidak bisa run Node.js") terbukti salah.

**Keputusan:** Node server menang → **ADR-008** dibuat (supersede ADR-005). `output: 'export'` adalah regresi tak sengaja (commit `cdd2fae`, Jun 13) yang mematikan middleware SSO. Dokumen yang sudah diupdate: ADR-008 (baru), ADR-005 (Superseded), `NOTES-STATIC-VS-SSR.md` (banner outdated), `CONTEXT.md` (term Hosting app).

## Approach: "Mirror-stok" Sequential Hardening

Fix dengan urutan yang sama seperti stok agar tiap langkah membuka langkah berikutnya secara bersih, dengan `yarn type-check` + `yarn build` sebagai verification gate.

### Phase 1 — Config hazards (production-critical, dahulukan)
- Hapus `next.config.js` (duplikat usang); simpan satu `next.config.ts`.
- Hapus `output: 'export'` **sepenuhnya** (bukan conditional `STATIC_EXPORT` — YAGNI, ADR-008 buat Node server permanen).
- Hapus key `eslint` (tidak didukung Next 16 — sumber 1 TS error + gotcha CLAUDE.md).
- Tambah `typescript.ignoreBuildErrors: true` (selaras stok).
- Bersihkan artifact `out/` (sisa mode static).

### Phase 2 — tsconfig & type errors
- Tambah `"baseUrl": "."` ke `apps/distribusi/tsconfig.json` (membuka error asli).
- Fix ~20 error implicit-`any` + module yang muncul → `yarn type-check` ke **0**.
- **Gate:** `yarn type-check` = 0, `yarn build` sukses.

### Phase 3 — Auth consolidation (fix cookie-domain SSO)
- Migrasi **16 file** call site: `createClient` dari `@/lib/supabase` → `createSupabaseBrowserClient` dari `@suka/auth`.
- **Hapus `src/lib/supabase.ts` sepenuhnya.** Browser export jadi redundan; `createServerSupabaseClient` (service-role) **tidak dipakai** & berisiko (jika ter-import ke client bundle, `SUPABASE_SERVICE_ROLE_KEY` bocor ke browser).
- **Gate:** `yarn type-check` = 0, `yarn build` sukses, smoke test login lintas-subdomain.

### Phase 4 — Hydration audit
- Bungkus ~10 render `toLocaleDateString('id-ID')` dengan helper client-only `useFormattedDate` (mirror pola `useEffect` stok), bukan `suppressHydrationWarning` tersebar.

### Phase 5 — Test infra (opsional, terakhir)
- Mirror stok: tambah `vitest` + `@testing-library/*` + script `test`/`test:watch`.
- Smoke test untuk alur surat-jalan & terima.

## Verification

- `yarn type-check` = 0 errors (gate setelah Phase 2 & 3).
- `yarn build` sukses (Node server, tanpa `output: 'export'`).
- Smoke test manual: login SSO lintas-subdomain, middleware `enforceAppAccess` jalan, alur surat-jalan + verifikasi penerimaan.

## Out of Scope

- Fitur baru distribusi (hanya hardening/perbaikan).
- Refactor yang tidak melayani tujuan hardening.
- Mengubah deployment distribusi yang sekarang LIVE (plan ini referensi untuk re-upload berikutnya).

## Referensi
- Playbook: `apps/stok` commit `ad58169`.
- [ADR-008](../../adr/0008-pivot-nodejs-server-cloudlinux-node-selector.md) — pivot ke Node server.
- CLAUDE.md → Deployment (langkah cPanel + Node Selector).
