# ADR-008 — Pivot ke Next.js Node server (CloudLinux Node Selector), supersede ADR-005

- Status: Accepted
- Tanggal: 2026-06-15
- Supersedes: [ADR-005](0005-nextjs-static-export-cpanel.md)

## Konteks
ADR-005 (2026-06-09) memutuskan **static export** (`output: 'export'`) untuk semua app, dengan premis utama: *"cPanel shared hosting tidak bisa run Node.js process"*. Premis itu **terbukti salah**: server produksi (connectindo, CloudLinux) menyediakan **Node Selector** yang menjalankan aplikasi Node persisten lewat Passenger/LiteSpeed — 1 subdomain = 1 Node app. `distribusi.sukashawarma.com` sudah **LIVE sebagai Next.js Node server** sejak 2026-06-12 (lihat CLAUDE.md → Deployment), memakai `server.cjs` (`next({ dev: false })`).

Sejak integrasi SSO, app juga memakai **`middleware.ts`** (`enforceAppAccess`) — per-request guard yang **hanya jalan di server** dan secara eksplisit tidak didukung oleh `output: 'export'`. Akibatnya kode terjebak di antara dua era: config masih `output: 'export'` (warisan ADR-005) sekaligus punya `middleware.ts` (era Node server) — dua hal yang saling bertentangan.

## Keputusan
Arsitektur deploy resmi = **Next.js Node server** di cPanel via **CloudLinux Node Selector + Passenger**, bukan static export.
- `next.config` **tidak** memakai `output: 'export'` (server mode default).
- `middleware.ts` (SSO `enforceAppAccess`) valid dan menjadi pola standar app-access guard.
- Logika server boleh memakai middleware/SSR Next.js **selain** Supabase RPC/RLS (RLS tetap garis pertahanan data utama).
- Deploy = build `.next` lalu jalankan via `server.cjs` (lihat CLAUDE.md untuk langkah cPanel).

## Alternatif yang ditolak
- **Tetap static export (pertahankan ADR-005)** — ditolak: butuh hapus `middleware.ts` & pindah SSO guard ke client/RLS, sekaligus rollback deployment Node-server yang sudah live & jalan. Tidak ada alasan teknis karena Node Selector tersedia.
- **Hybrid per-app (sebagian static, sebagian Node)** — ditolak untuk sekarang: menambah kompleksitas kriteria & dua jalur deploy; semua app sekarang seragam Node server.

## Konsekuensi
- (+) Middleware/SSO guard server-side jalan; sesi cookie cross-subdomain konsisten.
- (+) Seragam dengan deployment yang sudah live; tidak ada rollback.
- (+) Membuka opsi SSR/Next API routes bila perlu nanti (mis. push notif native).
- (−) Tiap subdomain = 1 Node app yang harus di-maintain (restart, env, build) — lebih berat dari upload folder statis.
- (−) Butuh disiplin: jangan pakai `output: 'export'` lagi; `out/` artifact harus dibersihkan.
- **Aksi dokumen:** ADR-005 ditandai *Superseded*; `docs/NOTES-STATIC-VS-SSR.md` diberi catatan pivot.
