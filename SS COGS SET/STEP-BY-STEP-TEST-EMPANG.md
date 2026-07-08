# Step-by-Step Testing BOM Automation — Outlet Empang

Panduan eksekusi langsung, ringkas. Untuk detail query/skenario tambahan lihat `TEST-PLAN-BOM-AUTOMATION.md`. Dokumen ini fokus ke **urutan kerja + titik kritis yang wajib diperhatikan**.

## ✅ Status: testing SELESAI (2026-07-04) — lolos

Order sederhana, quantity>1, dan void/cancel semua **lolos** dengan angka presisi penuh. 1 bug ditemukan di tengah proses (order sukses tapi `ledger_stok` kosong) — root cause: fungsi trigger butuh `SECURITY DEFINER` karena sesi testing lokal jalan sebagai `anon` (belum lewat SSO Portal penuh), sudah diperbaiki via migration `20260704200000`. Detail lengkap di `TEST-PLAN-BOM-AUTOMATION.md` bagian atas & `NEXT-PLAN.md`.

Dokumen di bawah ini tetap relevan sebagai referensi kalau mau ulang test / rollout ke outlet lain.

---

## 🔴 CRITICAL POINTS — baca dulu sebelum mulai

1. **Trigger BOM cuma aktif di outlet Empang** (`550e8400-e29b-41d4-a716-446655440002`). 18 outlet lain tidak kena — tapi **transaksi ASLI di Empang mulai sekarang SUDAH kena potong stok otomatis**. Kalau ada kasir/kru yang kerja di Empang hari ini, mereka sudah "ikut testing" tanpa sadar.
2. **Order bisa GAGAL total kalau stok bahan resep = 0.** Ada trigger lain (`ledger_stamp_saldo`) yang menolak transaksi kalau saldo jadi minus. Kalau ini terjadi, order **tidak bisa di-complete di kasir sama sekali** (bukan cuma salah catat). **Wajib cek stok dulu (Langkah 2) sebelum transaksi apa pun.**
3. **8 bahan baru** (SAOS CABE, PLASTIK VACUM, CUP+TUTUP, DUS PACKING, ES BATU, MIE, POWDER MIX, STIKER) hampir pasti **stok-nya 0** di Empang — belum pernah ada surat jalan yang mengirim bahan-bahan ini secara resmi.
4. **Rollback cepat kalau ada masalah:**
   ```sql
   DELETE FROM global_settings WHERE key = 'bom_automation_allowed_outlets';
   ```
   Ini langsung mematikan BOM automation di SEMUA outlet (termasuk Empang) tanpa perlu drop trigger.
5. Simpan **screenshot/catatan** tiap transaksi test (jam, produk, qty) — untuk dicocokkan manual ke `ledger_stok` nanti.

---

## Langkah 1 — Nyalakan aplikasi lokal

```bash
cd "D:/MIT/CLAUDE CODE PROJECT/SS DIGITAL PROJECT"
yarn workspace @suka/pos-kasir dev
```
Buka `http://localhost:3004`. Aplikasi ini connect ke **database produksi yang sama** (bukan database kosong lokal) — jadi transaksi yang kamu buat di sini **beneran masuk** ke Supabase produksi.

> Kalau mau pantau data via SQL bersamaan, buka juga Supabase SQL Editor di tab terpisah.

---

## Langkah 2 — WAJIB: cek stok bahan di Empang SEBELUM transaksi apa pun

Jalankan di SQL Editor:
```sql
SELECT b.nama, COALESCE(sb.saldo, 0) AS saldo_saat_ini, b.satuan
FROM (SELECT DISTINCT bahan_baku_id FROM resep_item) rb
JOIN bahan_baku b ON b.id = rb.bahan_baku_id
LEFT JOIN stok_balance sb ON sb.outlet_id = '550e8400-e29b-41d4-a716-446655440002' AND sb.bahan_baku_id = b.id
ORDER BY saldo_saat_ini ASC;
```

**Untuk setiap baris `saldo_saat_ini = 0`**, isi stok dummy dulu (cukup untuk beberapa kali test, tidak perlu banyak):
```sql
INSERT INTO ledger_stok (outlet_id, bahan_baku_id, tipe, qty, catatan)
VALUES ('550e8400-e29b-41d4-a716-446655440002', '<bahan_baku_id_dari_hasil_query>', 'adjustment', 50, 'Stok dummy test BOM Empang');
```
(Ganti `50` sesuai kebutuhan — untuk bahan gram seperti AYAM/SAPI pakai angka lebih besar mis. 5000, untuk pcs/lembar cukup 20-50.)

**Jangan lanjut ke Langkah 3 sampai semua baris di atas 0.**

---

## Langkah 3 — Login sebagai staff Empang di pos-kasir

Login pakai akun kru/kasir yang terdaftar di outlet Empang. Kalau tidak ada akun test, cek dulu:
```sql
SELECT id, name, role FROM outlet_staff WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002';
```

---

## Langkah 4 — Transaksi test lewat UI kasir (bukan SQL manual)

Lakukan berurutan, catat setiap order_number yang muncul:

| # | Skenario | Yang dilakukan | Yang diharapkan |
|---|---|---|---|
| 1 | Order sederhana | Pesan **1x Suka Chicken** (atau produk lain yg sudah ter-link menu), selesaikan sampai `completed` | Order sukses, tidak ada error di UI |
| 2 | Quantity > 1 | Pesan **3x produk yang sama**, selesaikan | Order sukses |
| 3 | Produk tanpa resep aktif | Kalau ada menu Subsidi/Online yang terjual di Empang, coba juga | Order tetap sukses `completed` (karena resep NULL, BOM cuma skip) |
| 4 | Void/Cancel | Ambil salah satu order tadi, batalkan/void dari sistem kasir | Order jadi `cancelled` tanpa error |

**Kalau order GAGAL diselesaikan / muncul error saat klik "Selesai"** → kemungkinan besar ini Critical Point #2 (stok bahan resep habis). Cek pesan error, biasanya berbunyi `"Stok tidak cukup: ..."`. Segera cek stok bahan terkait, tambah dummy stok lagi via Langkah 2, atau **jalankan rollback** kalau mau berhenti dulu.

---

## Langkah 5 — Verifikasi hasil di database

Untuk **setiap order** yang tadi di-`completed`-kan, jalankan:
```sql
SELECT o.order_number, o.status, l.bahan_baku_id, b.nama, l.tipe, l.qty, l.saldo_sebelum, l.saldo_sesudah, l.created_at
FROM orders o
JOIN ledger_stok l ON l.ref_order_id = o.id
JOIN bahan_baku b ON b.id = l.bahan_baku_id
WHERE o.outlet_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY o.order_number, b.nama;
```

**Cek manual:**
- Jumlah baris per order = jumlah bahan di resep produk tsb (lihat `cogs-bom.json` / `resep-seed.sql` utk hitung ulang)
- `qty` = **negatif**, besarnya = `qty_per_porsi_resep × quantity_order ÷ faktor_konversi` (lihat `VERIFIKASI-FAKTOR-KONVERSI.md` utk faktor tiap bahan)
- Order dengan quantity=3 → qty ledger harus **3× lipat** dari order quantity=1
- Order yang di-cancel (Skenario 4) → ada baris tambahan tipe `adjustment` qty **positif** dgn besar sama persis, dan `saldo_sesudah` balik ke angka sebelum order tsb dibuat

**Kalau ada order `completed` yang TIDAK muncul baris ledger sama sekali** — cek apakah produk itu memang salah satu dari 5 produk tanpa `menu_item_ref` (Subsidi/Online), itu **normal**. Kalau bukan salah satu dari 5 itu, berarti ada masalah link resep→menu yang perlu ditelusuri.

---

## Langkah 6 — Bersihkan data test (opsional tapi disarankan)

```sql
-- Hapus ledger hasil test (ganti rentang waktu sesuai kapan kamu testing)
DELETE FROM ledger_stok WHERE catatan ILIKE '%test%' OR ref_order_id IN (
  SELECT id FROM orders WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002'
    AND created_at > '2026-07-04 00:00:00'  -- sesuaikan jam mulai testing
);
```
> Hati-hati: kalau ada transaksi ASLI (bukan test) yang kebetulan terjadi di Empang di rentang waktu yang sama, JANGAN dihapus. Cocokkan dulu dengan catatan order_number yang kamu simpan di Langkah 4.

---

## Setelah semua lolos

- [ ] Semua skenario di Langkah 4 sesuai ekspektasi
- [ ] Tidak ada order yang gagal `completed` karena stok habis (atau kalau ada, sudah dipahami penyebabnya)
- [ ] Perhitungan `ledger_stok` di Langkah 5 cocok manual
- [ ] Data test sudah dibersihkan (Langkah 6)

Kalau semua lolos → siap tambah outlet lain ke allowlist satu-satu:
```sql
UPDATE global_settings
SET value = value || ',' || '<outlet_id_baru>', updated_at = now()
WHERE key = 'bom_automation_allowed_outlets';
```

---

*Dibuat: 2026-07-04. Lihat juga: `TEST-PLAN-BOM-AUTOMATION.md` (skenario lebih lengkap via SQL), `VERIFIKASI-FAKTOR-KONVERSI.md` (angka konversi per bahan).*
