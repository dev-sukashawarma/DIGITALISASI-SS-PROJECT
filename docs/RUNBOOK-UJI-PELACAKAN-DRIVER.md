# Runbook Uji Pelacakan Driver — tanpa mengganggu sistem berjalan

Spec: `docs/superpowers/specs/2026-10-27-pelacakan-driver-design.md`

## 1. Apa yang sudah live, dan kenapa aman

| Bagian live di DB | Menyentuh alur berjalan? | Bukti |
|---|---|---|
| Tabel `driver_perjalanan*`, `driver_lokasi_*` | Tidak — tabel baru, hanya ditulis RPC `driver_*` | t1, t2 |
| Trigger `trg_pelacakan_sinkron_sj` di `surat_jalan` | Ikut berjalan saat SJ diverifikasi/dibatalkan, **tidak pernah bisa menggagalkannya** (galat ditelan jadi WARNING) | t6 (galat buatan → verifikasi SJ tetap sukses) |
| Cron `driver-tutup-perjalanan` (15 mnt), `driver-retensi-jejak` (03:40 WIB) | Hanya tabel pelacakan | t3, `cron.job_run_details` sukses |
| Policy UPDATE SJ + `AND NOT is_driver_aktif()` | Hanya untuk akun role `driver`; kitchen/crew tetap sama | t1 (kitchen tetap bisa update) |
| `accessible_outlet_ids()` tanpa `driver` + baca SJ khusus driver | Hanya akun driver (dikembalikan ke keadaan sebelum perubahan manual hari ini) | t4 |

Tidak ada yang menulis `ledger_stok`, `stok_balance`, status SJ, atau qty.

## 2. Yang berubah saat web distribusi di-redeploy

- **Untuk semua role selain driver, tombol & alur tidak berubah.** Tambahannya hanya:
  - Baris status pengantaran di detail SJ.
  - Kalimat status antar di halaman Terima outlet. Untuk SJ yang tidak dilacak, tidak muncul apa pun.
  - Kartu "driver sedang antar" di dashboard (kitchen/admin/purchasing/owner/developer).
- **Tanda tangan "Supir Internal" tetap bisa memilih semua staf.** Fahmi, Ismansyah, Gilang, dan lainnya tetap ada. Akun driver hanya ditaruh paling atas, tanpa isian otomatis.
- **Driver di web:** hanya melihat SJ (read-only).

## 3. Yang berubah saat APK 1.1 dipasang

Hanya di HP yang dipasangi. Pasang **hanya di HP Adam** dulu.
- Menu Pengantaran hanya untuk role `driver`.
- Izin lokasi kini dideklarasikan di manifest. Ini juga memperbaiki absensi, yang selama ini meminta izin lokasi tanpa deklarasi.

## 4. Aturan saat menguji

- ✅ **Uji memakai pengiriman sungguhan Adam.** Pelacakan tidak mengubah stok, status SJ, atau qty, jadi aman ditumpangkan ke kiriman harian.
- ❌ **JANGAN membuat SJ uji lalu menandainya "dikirim".** Status `dikirim` memotong stok Gudang Pusat (trigger lama, bukan fitur ini).
- ❌ **JANGAN mengubah role staf lain jadi `driver` untuk uji.** Role driver kehilangan hak tulis outlet lewat jalur biasa.
- ✅ "Tiba", "Selesaikan Perjalanan", atau lupa menekan tombol apa pun: tidak berdampak ke stok maupun verifikasi outlet.

## 5. Urutan uji

1. Redeploy `distribusi`. Login sebagai kitchen dan pastikan alur lama jalan seperti biasa: buat SJ, tanda tangan Supir (Fahmi masih ada di daftar), kirim. Lalu buka `/distribusi/driver` — isinya harus "Tidak ada driver yang sedang mengantar".
2. Pasang APK 1.1 di HP Adam → login → menu Pengantaran → ikuti panduan izin.
3. Pada kiriman berikutnya, setelah kitchen menandai SJ "dikirim":
   - Adam memilih SJ, lalu Berangkat.
   - Pusat membuka peta dan memastikan pin bergerak.
4. Di tengah jalan, uji hal-hal ini:
   - layar mati 10 menit;
   - mode pesawat 5 menit, lalu titik harus menyusul;
   - app ditutup paksa dari recent apps, lalu dibuka → harus langsung kembali ke perjalanan.
5. Di tiap outlet Adam menekan Tiba. Crew outlet di halaman Terima harus melihat "Sedang diantar oleh Adam · …" tanpa peta.
6. Catat hasilnya, merek HP Adam, dan perlu-tidaknya langkah Autostart.
7. Cek DB dengan `supabase/verifikasi/pelacakan_driver/pemantau.sql` (Q1, Q2, Q5 harus 0).

## 6. Mematikan fitur bila ada masalah (tanpa menyentuh data lain)

```sql
-- 1) lepaskan trigger dari surat_jalan (alur SJ kembali persis seperti sebelum fitur)
ALTER TABLE public.surat_jalan DISABLE TRIGGER trg_pelacakan_sinkron_sj;
-- 2) hentikan jadwal
SELECT cron.unschedule('driver-tutup-perjalanan');
SELECT cron.unschedule('driver-retensi-jejak');
```

- **Web:** redeploy commit sebelumnya.
- **HP:** Adam cukup menekan "Selesaikan Perjalanan" atau mencopot APK.
- **Data pelacakan:** biarkan saja (tabel terpisah).

Menyalakan lagi: `ENABLE TRIGGER` + jalankan ulang dua `cron.schedule` di migration `20261027142000`.

## 7. Di luar fitur ini (perlu keputusan owner)

Pengantar internal terbanyak 60 hari terakhir ber-role `crew` (Fahmi 327 SJ, Ismansyah 63, Gilang 23); Adam 83. Mereka **tidak terlacak** kecuali akunnya diubah ke role `driver`. Kalau diubah, mereka kehilangan menu crew (absensi tetap ada).
