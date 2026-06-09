# ADR-006 — Sinkron data antar-akun pakai Edge Function + pg_cron, bukan n8n

- Status: Accepted
- Tanggal: 2026-06-09

## Konteks
Karena DB Outlet Suite di akun Supabase terpisah (ADR-004), perlu 2 sinkron lintas-akun: `outlets` (Ecosystem→Suite) dan agregat `sales` untuk reporting hub (ADR-002). Ekosistem sudah punya n8n (dipakai untuk CS chatbot), jadi sempat jadi kandidat default.

## Keputusan
Sinkron data inti pakai **Supabase Edge Function (Deno) dijadwalkan pg_cron**, bukan n8n. Fungsi membaca REST project Ecosystem dengan read key lalu upsert ke project Outlet Suite. Contoh fungsi: `sync-outlets`, `sync-sales`. n8n **tidak** dipakai untuk pipa data inti; tetap boleh untuk hal lain (chatbot, broadcast WA). Compliance dari MySQL = fase lanjut/opsional (di situ n8n boleh dipertimbangkan karena konektor MySQL lebih mudah).

## Alternatif yang ditolak
- **n8n untuk sinkron DB** — ditolak: ada instance/server n8n yang harus dijaga, workflow di luar repo (tak ter-version, tak ter-review). Surface ekstra untuk tim 2 dev.
- **Foreign Data Wrapper (FDW)** — tidak relevan karena 2 project di akun berbeda.

## Konsekuensi
- (+) Nol tool tambahan; stack satu (Supabase). Kode sinkron di repo → ter-version, ter-review, rollback mudah.
- (+) Konsisten dgn pola Edge Functions yang sudah dipakai ekosistem.
- (−) Konektor non-Supabase (mis. MySQL compliance) lebih repot di Edge Function → untuk itu n8n tetap opsi cadangan saat fase lanjut.
- (−) Perlu jaga read key Ecosystem sebagai secret di Edge Function (Supabase Secrets).
