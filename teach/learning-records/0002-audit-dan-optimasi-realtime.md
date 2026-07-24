# 0002 — Audit & Optimasi Realtime

**Tanggal:** 2026-07-23  
**Topik:** Supabase Realtime Publication & Optimasi CPU Database  
**Status:** Selesai & Dideploy

## Yang Dipelajari

1. **Beda Menulis Log vs Realtime**:
   - Menghapus tabel dari realtime publication **TIDAK** menghapus data log atau mematikan fitur monitoring.
   - Data tetap disimpan dengan aman di database.
   - Dashboard Next.js tetap ter-update secara berkala menggunakan polling HTTP (React Query `refetchInterval`) tanpa memerlukan websocket konstan.
2. **Biang Kerok Overhead**:
   - `system_health_log` menghasilkan ~20.000 log baru/hari dan terus disiarkan via websocket secara sia-sia karena tidak ada browser client yang mendengarkan. Hal ini membebani query `realtime.list_changes` hingga memakan **73.4%** total waktu database.
3. **Katalog Master Tetap Realtime (User Input)**:
   - Tabel-tabel seperti `bahan_baku`, `resep`, dan `supplier` tetap dipertahankan di realtime agar crew outlet langsung melihat update menu/harga terbaru detik itu juga saat diubah oleh admin pusat tanpa perlu refresh manual.
4. **Deploy Sukses**:
   - Migrasi baru `20300103000009_optimize_realtime_publication.sql` berhasil dibuat dan dideploy menggunakan `supabase db push`.

## Rencana Langkah Selanjutnya (ZPD)

Melanjutkan program belajar:
- **Lesson 03**: Row Level Security (RLS) — mendalami bagaimana RLS menyaring data per outlet dan dampaknya terhadap kecepatan query, serta cara mengaudit policy agar aman & cepat.
