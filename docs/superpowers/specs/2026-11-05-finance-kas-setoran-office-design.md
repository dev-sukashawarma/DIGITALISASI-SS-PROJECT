# Finance — Kas Setoran Outlet & Kas Office (+ Income Lainnya)

**Tanggal:** 2026-11-05 · **Status:** Disepakati lewat grilling, belum dikerjakan · **App:** `apps/finance` (+ DB)

## Latar (kondisi DB per 5 Nov 2026)

- Kas pusat hanya 2 lokasi: `SUKA PROFIT BERKAH` (bank BCA 48523399425, saldo sistem Rp 602,5 jt, 992 transaksi) dan `Kas Setoran` (tunai, saldo sistem Rp 110,9 jt).
- 21 lokasi `Kas Kecil <outlet>` (scope outlet), hampir semuanya kosong.
- Top-up petty cash (`source_type='petty_cash_topup'`, 463 trx, Rp 173 jt) selama ini keluar dari rekening setoran.
- Tidak ada lokasi Kas Office. Kategori `pemasukan_lain` ada di `lib/expenseCategories.ts` tapi 0 baris di DB.

## Keputusan

| # | Keputusan |
|---|---|
| K1 | Dua rekening **baru**: **0955193763** = rekening setoran outlet (PT Suka Profit Berkah); **0955381004** = rekening Kas Office. |
| K2 | Rekening lama BCA 48523399425 **ditutup**: lokasi dinonaktifkan (`is_active=false`), riwayat tetap ada, tak muncul di pilihan. |
| K3 | **Mulai bersih 1 November 2026.** Saldo lama & saldo awal dicocokkan **manual oleh finance** (bukan oleh sistem/skrip). |
| K4 | Transaksi 1–5 Nov yang tercatat di rekening lama **dipindah**: 74 setoran transfer (Rp 39.076.900) → rekening setoran 0955193763; 16 top-up petty cash (Rp 6.900.000) → Rekening Office 0955381004. 24 setoran tunai (Rp 15.048.000) tetap di Kas Setoran Tunai. Pindah lokasi saja (pola void → pindah → status semula), nominal & tanggal tak berubah. Jalankan dengan daftar id eksplisit + penjaga jumlah. |
| K5 | **Top-up petty cash outlet keluar dari Kas Office** (Transfer atau Tunai sesuai cara kirim), tidak lagi dari rekening setoran. |
| K6 | Kas Office diisi dari: receh setoran tunai, Income Lainnya, dan transfer dana dari rekening setoran (fitur Transfer antar-kas yang sudah ada). |
| K7 | **Setor ke Bank** (tunai → rekening): digabung lintas outlet, satu kali catat. Finance isi nominal disetor (wajib kelipatan Rp 50.000, ≤ saldo Kas Setoran Tunai); **sisa receh otomatis** ke Kas Office Tunai. Boleh menahan sebagian uang besar di Kas Setoran Tunai (opsi). Atribusi per outlet tetap di setoran awal. |
| K8 | **Income Lainnya = pendapatan pusat saja** → Laba Perusahaan ("Pendapatan Lain-lain"). Tidak menambah laba outlet maupun bagi hasil mitra. Asal outlet hanya keterangan. |
| K9 | Form Income Lainnya: kategori Minyak Jelantah · Kardus Bekas · Kompan/Jerigen Bekas · Equipment Bekas · Lainnya (wajib keterangan); masuk Kas Office Tunai atau Transfer; tanggal, nominal, pembeli wajib; asal outlet opsional; **bukti wajib**; pencatat admin_finance/admin/owner; batal/hapus hanya finance, tercatat siapa & kapan. |
| K10 | **Saldo awal 1 Nov tidak dipasang oleh sistem.** Finance mengisi sendiri (saldo awal lokasi baru + penyesuaian Kas Setoran Tunai Rp 110,9 jt) lewat halaman Lokasi/penyesuaian yang tercatat. Semua lokasi baru dibuat dengan `opening_balance = 0`, `opening_date = 2026-11-01`. |

## Struktur kas aktif

```
KAS SETORAN OUTLET                       KAS OFFICE
├─ Rekening Setoran 0955193763 (bank)    ├─ Rekening Office 0955381004 (bank)
└─ Kas Setoran Tunai (cash, lokasi lama) └─ Kas Office Tunai (cash, baru)
   [Setor ke Bank]                          [Catat Income Lainnya]
```

Pengelompokan butuh penanda di `cash_location` (mis. kolom `grup` = `setoran_outlet` | `office`), bukan tebakan dari label.

## Alur

1. Outlet setor → `record_cash_deposit` ke Rekening Setoran (transfer) atau Kas Setoran Tunai (tunai). Pilihan rekening bank hanya grup `setoran_outlet`.
2. Setor ke Bank → satu operasi atomik (RPC): keluar dari Kas Setoran Tunai sebesar total; masuk Rekening Setoran (nominal disetor) + Kas Office Tunai (receh). Bukti setoran bank wajib.
3. Dropping dana → Transfer dari Rekening Setoran ke Rekening Office / Kas Office Tunai.
4. Top-up petty cash → sumber dipilih dari grup `office` saja.
5. Income Lainnya → masuk Kas Office, tercatat sebagai `cash_transaction` (in) + baris pendapatan pusat untuk laporan laba.

## Yang perlu dicek saat implementasi

- `useCashData.ts` punya `DEFAULT_LOCATIONS` hardcode (BCA lama) sebagai fallback — buang/ganti.
- `updateCashDepositMethodAction` hanya mengizinkan lokasi `scope='pusat'`; tambahkan syarat grup `setoran_outlet`.
- Semua pembaca `source_type='petty_cash_topup'` (Dashboard, ReportsView, petty cash) — pastikan tidak mengasumsikan sumbernya rekening setoran.
- Laba Perusahaan (admin-dashboard & finance) membaca pendapatan lain-lain — paritas dua app (`opex.parity.test.ts`).
- Kategori `pemasukan_lain` di `expenseCategories.ts` dipakai atau diganti satu sumber kategori Income Lainnya.

## Di luar cakupan

- Rekonsiliasi saldo lama & saldo awal (finance, manual).
- 21 lokasi Kas Kecil outlet — tidak diubah.
