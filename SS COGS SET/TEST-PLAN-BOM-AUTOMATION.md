# Test Plan — Aktivasi BOM Automation (Auto-Deduct Stok)

Tujuan: memastikan trigger `trg_process_bom_stok` (versi baru, pakai `faktor_konversi`) memotong stok dengan **benar** sebelum dipakai di transaksi nyata 19 outlet.

## ✅ HASIL TESTING (2026-07-04) — LOLOS, dengan 1 bug ditemukan & diperbaiki

Testing dilakukan langsung via UI `pos-kasir` lokal di outlet Empang (bukan cuma SQL manual).

| Skenario | Hasil |
|---|---|
| Order sederhana (Shawarma Sapi Sedang, order #4213) | ✅ 12 baris ledger, semua qty & faktor konversi cocok persis (termasuk desimal panjang FOIL `0.046052631578947366`) |
| Quantity > 1 | ✅ dikonfirmasi user, potongan proporsional |
| Void/Cancel reversal (Shawarma Mix Jumbo, order #4215) | ✅ 13 baris `pemakaian` + 13 baris `adjustment` cermin sempurna, presisi penuh |
| Produk tanpa resep (Subsidi/Online) | ⏳ belum dicoba, opsional |
| Stok habis (exception) | ⏳ belum dicoba, opsional |

### 🐛 Bug kritis ditemukan: order sukses tapi ledger_stok kosong
**Gejala:** Order pertama (#4210) `completed` sukses di UI, tapi 0 baris `ledger_stok` — padahal semua kondisi cocok saat dicek manual (outlet allowlist ✓, menu_item_ref ✓, resep aktif ✓).

**Root cause:** Fungsi trigger tanpa `SECURITY DEFINER` → jalan pakai role sesi kasir. Testing lokal tanpa SSO Portal penuh → sesi `anon`. RLS `resep`/`resep_item`/`bahan_baku` cuma izinkan `authenticated` baca → pencarian resep kembali kosong diam-diam (bukan error).

**Fix:** migration `20260704200000_cogs_bom_automation_security_definer.sql` — tambah `SECURITY DEFINER SET search_path = public`. Setelah fix, order #4213 & #4215 berikutnya sukses penuh.

**Pelajaran:** kalau nanti ada laporan serupa (order sukses, stok tidak berubah) di outlet lain — cek dulu apakah user login lewat jalur SSO resmi (bukan akses langsung/dev). Tapi dengan fix `SECURITY DEFINER` ini seharusnya sudah tidak relevan lagi untuk kasus baru.

---

## ✅ Opsi B dipilih & sudah aktif — allowlist outlet Empang

**Status (2026-07-04):** Trigger `trg_process_bom_stok` v3 (dgn allowlist + faktor_konversi) sudah **ter-push**. Guard allowlist aktif via tabel `global_settings`, key `bom_automation_allowed_outlets` = `550e8400-e29b-41d4-a716-446655440002` (**SUKA SHAWARMA EMPANG**).

**Artinya:** BOM automation **HANYA jalan untuk order di outlet Empang**. 18 outlet lain **tidak terpengaruh sama sekali** — order mereka `completed`/`cancelled` seperti biasa, tanpa potongan stok BOM apa pun, sampai outlet mereka ditambahkan ke allowlist secara eksplisit.

**Cara tambah outlet lain nanti (setelah Empang lolos uji):**
```sql
UPDATE global_settings
SET value = value || ',' || '<outlet_id_baru>', updated_at = now()
WHERE key = 'bom_automation_allowed_outlets';
```

**Cara nonaktifkan total (semua outlet, termasuk Empang):**
```sql
DELETE FROM global_settings WHERE key = 'bom_automation_allowed_outlets';
```
(Trigger tetap terpasang tapi jadi no-op di semua outlet — fail-safe by default.)

Test plan di bawah sekarang fokus ke **outlet Empang saja** — baik lewat order buatan (Bagian 3) maupun **transaksi asli** di outlet tsb (aman, karena outlet lain tidak ikut kena).

---

## Bagian 1 — Pra-syarat WAJIB dicek sebelum aktivasi

### 1a. Cek stok_balance ada untuk semua bahan yang dipakai resep
**Ini paling kritis.** Ada trigger terpisah (`ledger_stamp_saldo`, migration `20260625130000`) yang **menolak** (RAISE EXCEPTION) transaksi kalau hasil pengurangan bikin saldo minus. Kalau BOM trigger mencoba potong bahan yang `stok_balance`-nya 0/belum ada di outlet tsb → **exception → seluruh transaksi penyelesaian order GAGAL** (order tidak bisa jadi `completed` sama sekali, bukan cuma potongan stok yang salah).

**Risiko konkret:** 8 bahan baru (SAOS CABE, PLASTIK VACUM, CUP+TUTUP, DUS PACKING, ES BATU, MIE, POWDER MIX, STIKER) kemungkinan besar **belum pernah** dicatat masuk stoknya di outlet manapun (baru dibuat hari ini). Kalau ini terjadi, begitu ada yang beli Suka Drink/Shawarmie/dll di outlet manapun, **order itu akan gagal diselesaikan** di POS — bukan cuma catatan stok yang salah.

Jalankan ini untuk setiap outlet yang akan menjual produk dari 21 resep kita (idealnya cek semua 19 outlet, minimal outlet yang dipakai testing):

```sql
-- Cek bahan yang dipakai resep TAPI belum ada stok_balance di outlet tertentu
SELECT o.name AS outlet, b.nama AS bahan, COALESCE(sb.saldo, 0) AS saldo_saat_ini
FROM outlets o
CROSS JOIN (SELECT DISTINCT bahan_baku_id FROM resep_item) rb
JOIN bahan_baku b ON b.id = rb.bahan_baku_id
LEFT JOIN stok_balance sb ON sb.outlet_id = o.id AND sb.bahan_baku_id = b.id
WHERE o.id = '550e8400-e29b-41d4-a716-446655440002'  -- SUKA SHAWARMA EMPANG
ORDER BY saldo_saat_ini ASC;
```

Untuk baris dengan `saldo_saat_ini = 0`, **isi dulu stok dummy** (secukupnya untuk 1 kali test, misal 1000 gram/5 pcs) via ledger manual sebelum test, supaya order testing tidak gagal karena saldo minus:

```sql
-- Contoh isi stok dummy (SESUAIKAN outlet_id & bahan_baku_id hasil query di atas)
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
VALUES ('<outlet_id>', '<bahan_baku_id>', 'adjustment', 1000, 'Stok dummy utk test BOM automation');
```

### 1b. Konfirmasi trigger & allowlist sudah aktif (✅ sudah dilakukan 2026-07-04)
```sql
SELECT proname FROM pg_proc WHERE proname = 'trg_process_bom_stok';                 -- harus ADA
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_orders_bom_stok';                 -- harus ADA
SELECT * FROM global_settings WHERE key = 'bom_automation_allowed_outlets';         -- harus berisi id Empang
```

---

## Bagian 2 — Aktivasi ✅ SELESAI (2026-07-04)

Migration yang sudah ter-push:
- `20260704170000_cogs_bom_automation_with_allowlist.sql` — trigger v3 (faktor_konversi + allowlist guard)
- `20260704180000_cogs_enable_bom_automation_empang.sql` — isi allowlist dgn outlet Empang

Tinggal lakukan Bagian 1a (cek `stok_balance` outlet Empang) sebelum lanjut ke skenario testing Bagian 3.

---

## Bagian 3 — Skenario Test (pakai order buatan via SQL, BUKAN order asli customer)

Gunakan outlet uji pilihan kamu. **Catat `outlet_id` dan `saldo` SEBELUM setiap skenario** (query di Bagian 5), baru jalankan skenario, baru cek lagi SESUDAH.

### Skenario 1 — Order sederhana, qty=1, bahan faktor 1:1
Pilih produk dgn semua bahan `faktor_konversi=1` (paling gampang diverifikasi), misal **Suka Drink Ice Tea** (5 bahan, semua pcs/lembar 1:1).

```sql
-- 1. Buat order (status pending dulu)
INSERT INTO orders (outlet_id, order_number, status, payment_method, total_amount)
VALUES ('<outlet_id>', nextval(pg_get_serial_sequence('orders','order_number')), 'pending', 'cash', 9586)
RETURNING id;  -- catat order_id

-- 2. Tambah item (pakai menu_item_id 'Ice Tea': 3100cae9-81f4-403d-bb88-5c1c84479400)
INSERT INTO order_items (order_id, menu_item_id, menu_item_name, quantity, unit_price, subtotal)
VALUES ('<order_id>', '3100cae9-81f4-403d-bb88-5c1c84479400', 'Ice Tea', 1, 9586, 9586);

-- 3. Selesaikan order -> trigger BOM harus jalan di sini
UPDATE orders SET status = 'completed' WHERE id = '<order_id>';
```

**Ekspektasi:** 5 baris baru di `ledger_stok` (tipe `pemakaian`), qty **negatif**, sebesar `qty_per_porsi ÷ faktor_konversi` (semua faktor=1, jadi qty ledger = qty resep persis: POWDER MIX -40, CUP+TUTUP -1, PLASTIK MERAH -1, STIKER -1, ES BATU -1).

### Skenario 2 — Bahan dgn faktor konversi besar (kg→gram, pastikan tidak dibulatkan salah)
Pilih produk yang pakai **MINYAK SAYUR** (faktor 16.000) atau **SAOS CABE** (faktor 1.000), misal **Shawarma Ayam Sedang** (qty=1). Cek baris MINYAK SAYUR: qty resep 25 gram ÷ faktor 16.000 = **-0.0015625 kompan**. Pastikan angka desimal ini **tersimpan utuh** di `ledger_stok.qty`, tidak dibulatkan ke 0 atau ke integer.

### Skenario 3 — Quantity > 1
Ulangi Skenario 1 tapi `quantity = 3`. Pastikan potongan **3× lipat** dari Skenario 1 (mis. POWDER MIX jadi -120, bukan -40).

### Skenario 4 — Void/cancel (reversal)
Ambil order dari Skenario 1 (masih `completed`), lalu:
```sql
UPDATE orders SET status = 'cancelled' WHERE id = '<order_id>';
```
**Ekspektasi:** 5 baris baru tipe `adjustment` dengan qty **positif**, mengembalikan tepat sejumlah yang dipotong sebelumnya (`saldo_sesudah` balik ke `saldo_sebelum` awal skenario 1).

### Skenario 5 — Produk dengan `menu_item_ref` NULL (5 produk kita: Subsidi/Online)
Buat order pakai `menu_item_id` yang **valid tapi tidak match resep manapun** (atau bikin order dgn `menu_item_id` dari produk yang belum ada menu POS-nya — kalau tidak memungkinkan, cukup verifikasi logikanya lewat pembacaan kode: `IF v_resep_id IS NOT NULL THEN ... END IF` — kalau resep tidak ketemu, **tidak ada apa pun yang terjadi ke ledger_stok**, order tetap `completed` normal tanpa error).
**Ekspektasi:** order sukses `completed`, **tidak ada baris baru** di `ledger_stok`.

### Skenario 6 — Bahan dengan saldo pas-pasan/nol (uji exception dari `ledger_stamp_saldo`)
Sengaja pilih 1 bahan, set `stok_balance.saldo` ke angka kecil di bawah kebutuhan resep (mis. 0), lalu coba selesaikan order yang pakai resep tsb.
**Ekspektasi:** `UPDATE orders SET status='completed'` **GAGAL total** dengan error `"Stok tidak cukup: ..."` — **order TIDAK jadi completed** (rollback). Ini penting diketahui: kasir akan mengalami order yang tidak bisa di-complete kalau stok bahan resep habis. Catat perilaku ini, putuskan apakah ini perilaku yang diinginkan atau perlu penanganan khusus (mis. tetap izinkan selesai tapi catat shortage) — **di luar scope test plan ini, perlu keputusan produk terpisah**.

---

## Bagian 4 — Bersihkan data test
Setelah semua skenario selesai & diverifikasi, hapus jejak test (supaya tidak mengotori data produksi):
```sql
DELETE FROM ledger_stok WHERE catatan ILIKE '%test BOM automation%' OR ref_order_id IN (SELECT id FROM orders WHERE notes ILIKE '%TEST%');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE notes ILIKE '%TEST%');
DELETE FROM orders WHERE notes ILIKE '%TEST%';
```
*(Tandai order test dengan `notes = 'TEST BOM automation 2026-07-04'` saat insert supaya mudah dibersihkan.)*

---

## Bagian 5 — Query bantu: cek saldo sebelum/sesudah
```sql
SELECT b.nama, sb.saldo, sb.updated_at
FROM stok_balance sb JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.outlet_id = '<outlet_id>'
ORDER BY b.nama;
```

## Bagian 6 — Query pemantauan pasca-aktivasi (semua outlet, real-time)
Jalankan berkala di jam-jam pertama setelah aktivasi live:
```sql
-- Order completed 1 jam terakhir yg TIDAK menghasilkan ledger BOM (mungkin resep blm lengkap/menu blm di-link)
SELECT o.id, o.order_number, o.outlet_id, o.status, o.created_at
FROM orders o
WHERE o.status = 'completed' AND o.created_at > now() - interval '1 hour'
  AND NOT EXISTS (SELECT 1 FROM ledger_stok l WHERE l.ref_order_id = o.id);

-- Saldo bahan yg mendekati/di bawah 0 (indikasi shortage / kemungkinan salah faktor konversi)
SELECT o.name AS outlet, b.nama, sb.saldo
FROM stok_balance sb
JOIN outlets o ON o.id = sb.outlet_id
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
WHERE sb.saldo <= 0
ORDER BY sb.saldo ASC;
```

## Bagian 7 — Rollback cepat (kalau ada masalah setelah live)
```sql
DROP TRIGGER IF EXISTS trg_orders_bom_stok ON public.orders;
```
Ini **langsung menghentikan** auto-deduct tanpa menyentuh data yang sudah terlanjur masuk (ledger_stok lama tetap ada, cuma tidak ada potongan baru). Order yang sudah gagal karena exception saldo minus (Skenario 6) **tidak otomatis pulih** — tetap perlu penanganan manual per kasus.

---

## Kriteria lolos sebelum dianggap aman untuk semua 19 outlet
- [x] Bagian 1a: semua bahan di 21 resep punya `stok_balance` (bukan 0) di outlet Empang — sudah diisi via `20260704190000_cogs_refill_stok_empang.sql`
- [x] Skenario 1-4 sesuai ekspektasi (angka pas, termasuk desimal) — **lolos**, lihat hasil di atas
- [ ] Skenario 5: produk tanpa resep aktif tidak error (opsional, belum dicoba)
- [ ] Skenario 6: perilaku "gagal total kalau stok kurang" (opsional, belum dicoba)
- [ ] Rencana pemantauan (Bagian 6) — siap dipakai kalau mau rollout ke outlet lain
- [ ] Data test di Empang (order buatan/manual, kalau ada) belum dibersihkan — order #4213/#4215 dari UI kasir asli, bukan data SQL manual, jadi **tidak perlu dihapus** (transaksi valid, bukan sampah test)

**Kesimpulan:** Skenario inti (1-4) lolos semua. Outlet Empang siap dianggap "teruji" untuk BOM automation. Skenario 5-6 opsional, bisa ditunda tanpa menghalangi keputusan rollout ke outlet lain.

---

*Dibuat: 2026-07-04. Diperbarui 2026-07-04 setelah testing selesai — semua skenario inti lolos, 1 bug (`SECURITY DEFINER`) ditemukan & diperbaiki di tengah proses.*
