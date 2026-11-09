# Runbook — Ganti Satuan BAWANG PUTIH BUBUK (sachet → gram)

**Bahan:** BAWANG PUTIH BUBUK `516dd4a9-65df-4e58-adf6-d0e1f15ad9b5`
**Sekarang:** Dus → Bungkus (6) → Sachet, 1 Dus = 432 sachet, vendor Bapak Marwan Rp 400.000/Dus.
**Sesudah:** Kg → gram, 1 Kg = 1.000 gram, satuan PO **Kg**, satuan kirim ke outlet **Kg**.
**Jembatan:** 1 sachet lama = **6 gram** (keputusan owner 2026-11-09).
**Fitur:** tombol **Ganti Satuan** di Master Bahan Baku (spec `docs/superpowers/specs/2026-11-09-ganti-satuan-bahan-baku-design.md`).

## Prasyarat
- `admin-dashboard` dan `stok` sudah diredeploy dengan fitur Ganti Satuan.
- Dijalankan oleh admin/owner/developer.
- **Saat stok bahan tidak sedang bergerak**: di luar jam opname (±21:00–23:00) dan tidak ada
  verifikasi surat jalan / penerimaan PO bahan ini yang sedang berjalan. Transaksi stok yang
  berjalan bersamaan membaca satuan lama dan tercatat dengan angka satuan lama sesudah
  konversi (tidak bisa dicegah database). Pratinjau menampilkan peringatan kuning bila bahan
  bergerak dalam 15 menit terakhir — kalau muncul, tunggu dulu. Bawang putih bubuk tidak dipakai
  resep, jadi penjualan tidak menggerakkannya. App crew mengambil ulang satuan paling lambat
  60 detik (native & web).

## Langkah
1. **Kabari outlet** (grup WA): "Mulai hari ini bawang putih bubuk dihitung dalam **gram**.
   Sachet lama yang masih ada: 1 sachet = 6 gram."
2. **Selesaikan draft opname** yang memuat bahan ini (per 2026-11-09 ada 4). Pratinjau di modal
   akan menyebut outlet-nya; tombol Ganti Satuan tetap ditolak selama masih ada.
3. **Ganti satuan:** Master Bahan Baku → BAWANG PUTIH BUBUK → Satuan → **Ganti Satuan**:
   satuan besar `Kg`, satuan kecil `gram`, tanpa tengah, `1 Kg = 1000 gram`, Satuan PO `Kg`,
   Satuan kirim `Kg`, jembatan `6`, alasan "ganti vendor, dibeli kiloan".
   Cek pratinjau: Sawangan (Internal) 144 Sachet → 864 gram; BNR 0,1667 Dus → 0,432 Kg;
   harga master Rp 400.000/Dus → ±Rp 154.321/Kg. Ketik nama bahan → **Ganti satuan**.
4. **Vendor:** di seksi Vendor panel yang sama, **Nonaktifkan** Bapak Marwan, lalu
   **Tambah harga vendor** baru (daftarkan supplier dulu bila belum ada) dengan "Dibeli per kg".
5. **Cek sesudahnya** (SQL, read-only):
   ```sql
   SELECT satuan, satuan_kecil, faktor_tampilan, satuan_po, satuan_distribusi, satuan_diganti_at
     FROM bahan_baku WHERE id = '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5';
   SELECT o.name, sb.saldo FROM stok_balance sb JOIN outlets o ON o.id = sb.outlet_id
    WHERE sb.bahan_baku_id = '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5' ORDER BY sb.saldo DESC;
   SELECT * FROM bahan_baku_ganti_satuan WHERE bahan_baku_id = '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5';
   -- Baris ledger yang tertulis sesudah ganti satuan: cek manual angkanya masuk akal (gram, bukan sachet)
   SELECT l.created_at, o.name, l.tipe, l.qty, l.saldo_sebelum, l.saldo_sesudah
     FROM ledger_stok l JOIN outlets o ON o.id = l.outlet_id
     JOIN bahan_baku b ON b.id = l.bahan_baku_id
    WHERE l.bahan_baku_id = '516dd4a9-65df-4e58-adf6-d0e1f15ad9b5' AND l.created_at >= b.satuan_diganti_at
    ORDER BY l.created_at;
   ```

## Kalau keliru
Ganti satuan bisa dibalik dengan tombol yang sama: satuan lama `Dus / Bungkus 6 / Sachet`,
`1 Bungkus = 72 Sachet`, jembatan `1/6` (`0,166667` — 1 gram = 1/6 sachet). Uji bolak-balik
sudah lulus di `supabase/verifikasi/ganti_satuan/t3_eksekusi.sql`.
