# ADR-005 — Next.js static export untuk deploy ke cPanel shared (penyedia lokal)

- Status: Accepted
- Tanggal: 2026-06-09

## Konteks
Hosting = **server cPanel CloudLinux shared** dari penyedia lokal (terkonfirmasi via metrik LVE: Entry Processes 40, Number of Processes 450, RAM 6GB, **no root access**). Postgres tersedia di server tapi **tidak dipakai** (DB = Supabase cloud, beda akun). App suite = tool internal (absensi, stok, distribusi, dashboard) yang datanya via Supabase. Karena shared (no root), SSR/Node app persisten berliku & rapuh; kapasitas server (39GB disk, ∞ bandwidth, ∞ subdomain) kegedean untuk static.

## Keputusan
Bangun app dengan **Next.js + TypeScript** tapi konfigurasi **`output: 'export'`** (static export) → di-deploy sebagai file statis ke cPanel. Logika server (auth, RPC, cron, sinkron) di **Supabase Edge Functions + pg_cron**, bukan Next API routes/SSR. Data diambil client-side via Supabase JS + RLS — pola yang sama dengan app produksi existing.

## Alternatif yang ditolak
- **Next.js SSR di Vercel** — ditolak: owner mau cPanel (1 ekosistem hosting).
- **Next.js SSR/Node di cPanel** — ditolak: operasional rumit, rawan.
- **Vanilla JS (seperti POS lama)** — ditolak: tim mau DX TypeScript/komponen; static export memberi itu tanpa kehilangan kemudahan deploy.

## Konsekuensi
- (+) Deploy mulus ke cPanel (upload folder `out/`), konsisten dgn existing, biaya rendah.
- (+) Tetap dapat TypeScript + komponen + design-system package.
- (−) Tanpa SSR/Next API routes/middleware → semua logika server pindah ke Edge Functions/RLS (sudah jadi pola ekosistem, jadi OK).
- (−) Tidak ada server-side secret di app → aman selama hanya pakai anon key + RLS ketat.
