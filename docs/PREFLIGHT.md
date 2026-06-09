# Pre-Flight Checklist — Sebelum Eksekusi M0

> Gerbang kesiapan. Eksekusi M0 dimulai **setelah** semua item ⛔ terpenuhi.

## ✅ Sudah pasti (terverifikasi / diputuskan)
- [x] Scope, modul (M0–M4), pembagian 2 dev — `docs/PRD.md`
- [x] Glossary domain — `CONTEXT.md`
- [x] Keputusan arsitektur — `docs/adr/` (ADR-001..005)
- [x] Plan migrasi DB & topologi 2 project — `docs/DB-MIGRATION-PLAN.md`
- [x] `outlets` punya `lat`/`lng` (GPS feasible) — konvensi seed terisi
- [x] Design tokens tersedia — `LINKTREE SS/SUKA Shawarma Design System/colors_and_type.css`
- [x] DB: Supabase project **baru terpisah** (ADR-004)
- [x] Stack: Next.js static export → cPanel (ADR-005)
- [x] Hosting terkonfirmasi: **cPanel CloudLinux shared** (no root, RAM 6GB, ∞ subdomain) — cukup utk static; subdomain per modul (`absensi.`/`stok.`/`distribusi.`/`dashboard.`). Postgres cPanel diabaikan (pakai Supabase cloud beda akun)
- [x] Device outlet: HP/tablet Android per outlet (face-api.js + GPS OK)
- [x] Biometrik: lanjut dgn **consent** + kebijakan retensi (masuk desain M1)

## ⛔ Wajib disediakan owner/tim sebelum M0 (blocker)
- [ ] **Supabase project BARU** dibuat → kirim `Project URL`, `anon key`, `service_role key`
- [ ] **Read access ke Supabase produksi (Ecosystem)** → service key read-only utk sinkron 19 outlet (uuid asli ada di produksi, bukan di seed)
- [ ] ~~Akses n8n~~ → **tidak perlu**; sinkron `outlets` & `sales_rollup` pakai Edge Function + pg_cron (ADR-006)
- [ ] **Repo Git** dibuat di GitHub org (usulan: `sukashawarma-outlet-suite`, monorepo) + akses 2 dev
- [ ] **Kredensial deploy cPanel** (FTP/Git deploy) utk subdomain (usulan: `absensi.`, `stok.`, dll)
- [ ] **Konfirmasi data:** apakah ke-19 outlet produksi `lat`/`lng`-nya **terisi semua** (bukan NULL)? Jika ada NULL → kumpulkan koordinat dulu (M1 butuh)

## 📋 Perlu dikonfirmasi (non-blocker, bisa paralel)
- [ ] Siapa Dev A / Dev B + tool masing-masing (Claude Code / Codex / Antigravity)
- [ ] Adakah Supabase **staging** utk uji migrasi sebelum ke project utama?
- [ ] Daftar awal **bahan baku** + satuan + reorder point (utk seed M2)
- [ ] Radius GPS toleransi per outlet (default usulan: 75–100m, outlet indoor sinyal lemah)
- [ ] Teks consent biometrik + periode retensi selfie audit (mis. 90 hari)

## ⚠️ Risiko yang diakui
- Tanpa liveness, face match rawan foto-dari-foto → mitigasi: kamera live + GPS + selfie audit + spot-check SPV (liveness fase lanjut). ADR-003
- 2 sinkron lintas-akun (outlets + sales) jadi titik rawan → Edge Function + pg_cron, pantau via log Supabase. ADR-004/006
- Akurasi face-api.js tergantung pencahayaan outlet → kalibrasi threshold per kondisi.
- Library face-api.js relatif lama → pertimbangkan fork aktif (`@vladmandic/face-api`) saat M1.
