# ADR-002 — Supabase sebagai reporting hub untuk Owner Dashboard

- Status: Accepted (di-amandemen oleh ADR-004)
- Tanggal: 2026-06-09

> **Amandemen (ADR-004):** modul baru kini di Supabase project terpisah, sehingga reporting hub berada di project Outlet Suite dan **agregat sales disinkron** dari Ecosystem (bukan satu project tunggal seperti asumsi awal). Lihat `docs/DB-MIGRATION-PLAN.md` §4.

## Konteks
Data bisnis tersebar: Supabase (online order TiktokGo, POS baru nanti, modul baru), Postgres (SS-WEBAPP HR pusat), MySQL (Checklist Form compliance). Owner butuh dashboard P&L/analitik. Mayoritas data inti (order, POS, stok, absensi outlet, shipment) **sudah di satu Supabase**.

## Keputusan
Jadikan **Supabase sebagai reporting hub tunggal**. Agregasi berat lewat **materialized views + pg_cron** dengan refresh berlapis: "hari ini" ~2 menit, historis jam/harian. Sinkron `outlets` + agregat sales dari Ecosystem via **Edge Function + pg_cron** (ADR-006). Compliance (MySQL) widget sekunder **fase lanjut** (opsional). HR pusat (Postgres) **tidak diintegrasi** (di luar scope; link keluar bila perlu). Dashboard = 1 app Next.js baca Supabase.

## Alternatif yang ditolak
- **Live cross-DB query** (Supabase + Postgres + MySQL digabung saat runtime) — ditolak: rapuh terhadap perubahan skema sumber, lambat di volume transaksi besar, mahal, dan memperketat coupling antar sistem.

## Konsekuensi
- (+) Dashboard cepat (<1 dtk, pra-agregasi), murah, terisolasi dari perubahan sumber.
- (+) Near-real-time cukup untuk keputusan owner.
- (−) Ada latency data (menit/jam) — diterima karena owner butuh analitik, bukan ticker.
- (−) Perlu sinkron lintas-akun (Edge Function + pg_cron) untuk outlets & sales. ADR-006
