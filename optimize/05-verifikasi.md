# 05 — Verifikasi Sebelum Menerapkan ke Produksi

Database produksi dipakai bersama banyak app & developer. Urutan wajib:

## 1. Catat angka acuan dari cara lama
Simpan hasil fungsi/halaman lama (total, ringkasan, rekap per staf) untuk rentang nyata.

## 2. Dry-run di transaksi yang dibatalkan
Jalankan isi migration + query pemeriksa, lalu `RAISE EXCEPTION` berisi hasilnya.
Exception membatalkan seluruh transaksi → **tidak ada yang tersimpan**.

```sql
<isi migration>;
DO $x$ BEGIN RAISE EXCEPTION '%', (SELECT json_build_object(...)::text); END $x$;
```

Pastikan setelahnya objek baru **tidak ada** (`to_regclass('public.tabel_baru') IS NULL`).

## 3. Bandingkan angka baru vs lama
Harus **identik** (atau selisihnya bisa dijelaskan satu per satu). Contoh HR:
total 1.352 = 1.352, ringkasan sama, rekap payroll 1.322 hari / 15.621 menit = data mentah.

## 4. Uji perilaku trigger (masih di transaksi yang dibatalkan)
Sisipkan / ubah / hapus data contoh dan cek tabel rekap berubah benar. Contoh HR:
`[awal] alfa → [absen susulan] hadir → [absen dihapus] alfa → [sakit disetujui] sakit →
[tgl merah] 0 alfa → [tgl merah dihapus] 20 alfa`.

## 5. Uji beban sintetis
Isi ratusan ribu baris palsu **di dalam transaksi yang dibatalkan**, `ANALYZE`, lalu ukur
`clock_timestamp()` sebelum/sesudah pemanggilan RPC untuk rentang pendek, panjang, halaman
dalam, pencarian, filter. Hindari statement timeout (±150 ribu baris masih aman).

## 6. Rencana eksekusi
`EXPLAIN (ANALYZE, BUFFERS)` pada isi query (fungsi plpgsql tidak terlihat dari luar →
salin body-nya dengan parameter diganti nilai). Cari: `Index Scan`, `top-N heapsort`,
`Buffers: shared hit` (tanpa baca disk). Hindari `Seq Scan` pada tabel besar.

## 7. Terapkan + stempel riwayat
Terapkan migration lalu catat di `supabase_migrations.schema_migrations`
(`version, name, statements`) agar `db push` tidak menjalankannya ulang.
Cek dulu timestamp tidak bentrok: `ls supabase/migrations | cut -c1-14 | sort | uniq -d`
dan `node scripts/migration-timestamp-lint.mjs <file>`.

## 8. Uji RLS & end-to-end dengan login sungguhan
Lihat [04-rls-keamanan.md](04-rls-keamanan.md). Untuk pagination: jumlahkan baris seluruh
halaman → harus sama dengan `total`, dan tanggal terawal = awal rentang.

## 9. Build & test app
`tsc --noEmit`, `vitest run`, `next build --webpack` di app yang diubah.
