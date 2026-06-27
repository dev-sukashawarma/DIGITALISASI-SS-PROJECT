# Runbook — Sinkronisasi Penjualan POS → Dashboard Owner

Menyalin penjualan POS **paid + selesai** dari project *sistem order*
(`qntuhtkujpwudcpudwbj`) ke tabel `orders` **DB Utama** (`khpkoreaaucvyqfhynfq`),
sehingga otomatis masuk view SPV (`sales_summary_spv`, `sales_hourly_spv`) dan
dashboard owner. UPSERT idempoten via `external_order_id` (anti-duplikat).

## Definisi data yang disinkron
- `status = 'done'` **DAN** (`paid_at` terisi **ATAU** `payment_method ∈ {cash, manual}`)
- Omzet = `total` (termasuk service fee) → `orders.total_amount`
- `sales_source = 'pos'`, `source = 'pos_sync'`
- Outlet dipetakan via tabel `pos_outlet_map` (id antar-project berbeda)

## Langkah deploy (sekali)

1. **Terapkan migrasi** (buat `pos_outlet_map`, index unik, trigger order_number, `pos_sync_state`):
   ```bash
   supabase db push      # menerapkan 20260626160000_pos_sales_sync.sql
   ```

2. **Set secrets** Edge Function (project DB Utama):
   ```bash
   supabase secrets set \
     ORDER_SYS_URL=https://qntuhtkujpwudcpudwbj.supabase.co \
     ORDER_SYS_SERVICE_KEY=<service_role_sistem_order>
   # SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah otomatis tersedia
   ```

3. **Deploy function:**
   ```bash
   supabase functions deploy sync-pos-sales
   ```

4. **Backfill seluruh riwayat** (sekali, pakai ?full=1):
   ```bash
   curl -X POST "https://<main-ref>.functions.supabase.co/sync-pos-sales?full=1" \
     -H "Authorization: Bearer <main_service_role>"
   # contoh respons: { ok:true, candidates:83, upserted:81, skipped_unmapped:2 }
   ```

5. **Jadwalkan tiap 10 menit** (pg_cron + pg_net, jalankan di SQL Editor DB Utama):
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule(
     'sync-pos-sales',
     '*/10 * * * *',
     $$
     select net.http_post(
       url     := 'https://<main-ref>.functions.supabase.co/sync-pos-sales',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization','Bearer <main_service_role>'
       )
     );
     $$
   );
   ```

## Catatan
- **Incremental**: function menyimpan cursor `updated_at` di `pos_sync_state`. Panggilan
  rutin hanya memproses order yang berubah. `?full=1` mengabaikan cursor (untuk backfill / audit).
- **Idempoten**: aman dipanggil berkali-kali; tidak menggandakan order.
- **Outlet belum dipetakan** (mis. 'cabang baru buka', 'Suka Shawarma Test') dilewati
  dan dilaporkan di `skipped_unmapped`. Tambahkan ke `pos_outlet_map` bila perlu.
- Fungsi lama `webhook-sync-order` menangani arah berbeda & hanya menangkap `status='completed'`
  (sistem order memakai `'done'`), sehingga melewatkan penjualan tunai/manual. Function ini
  menggantikannya sebagai kanal resmi POS→Utama.
