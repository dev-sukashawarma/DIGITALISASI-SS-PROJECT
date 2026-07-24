# 0001 — Fondasi Backend: Arsitektur & Query Performance

**Tanggal:** 2026-07-23  
**Topik:** Peta backend SS Digital + Cara mendeteksi query lambat  
**Status:** Session pertama — fondasi

## Yang Dipelajari

Kamu belajar bahwa backend SS Digital terdiri dari **4 lapisan**:
- Client (Next.js apps di cPanel)
- Edge Functions (Deno serverless, 14 functions)
- Database PostgreSQL via Supabase (core semua data)
- Storage + External (foto, Ecosystem DB)

Dan bahwa **database queries adalah bottleneck utama** yang paling sering perlu dimaintain.

## Insight Kunci

1. **EXPLAIN ANALYZE** adalah alat utama untuk diagnosis. `Seq Scan` + `Rows Removed by Filter` besar = butuh index.
2. **`CONCURRENTLY`** wajib saat buat index di production — tanpanya tabel di-lock.
3. Project sudah punya pg_stat_statements aktif (migration `20260623120000`) — ini tools monitoring gratis yang sudah ada.
4. Ada 307 migration files — ini menandakan sistem sudah matang tapi juga perlu hati-hati saat push migration baru.

## Zona Proksimal Berikutnya

Lesson selanjutnya: **RLS (Row Level Security)** — cara kerja dan cara auditnya.
Ini penting karena project ini punya banyak role (11+ role!) dan data 19 outlet yang harus terisolasi dengan benar.

## Catatan Konteks

- Background: vibe coding + reverse engineering — belajar dari hasil bukan dari teori
- Gaya belajar: contoh nyata dari project sendiri, tidak abstrak
- Bahasa: Indonesia dengan istilah teknis Inggris dijelaskan saat muncul pertama
