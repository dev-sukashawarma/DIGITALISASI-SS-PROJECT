# 02 — Tabel Rekap yang Dipelihara Trigger

## Kapan dipakai

Data mentah harus **dikelompokkan dulu** sebelum ditampilkan/dihitung, misalnya:
- absensi: 2 baris mentah (clock-in, clock-out) → 1 baris per staf per hari
- penjualan per outlet per hari, stok per bahan per hari, dsb.

Mengelompokkan ulang di setiap request = biaya sebanding **panjang rentang tanggal**.
Tabel rekap membuat biaya sebanding **ukuran halaman**.

## Pola

```
tabel mentah (attendance) ──trigger AFTER INSERT/UPDATE/DELETE──► fungsi hitung(kunci)
                                                                     │  hitung ulang 1 kunci
                                                                     ▼  dari baris mentah
                                                     tabel rekap (attendance_harian)
                                                     PK = (staff_id, outlet_id, tgl)
```

Prinsip:
1. **Hitung ulang per kunci, idempoten.** Trigger tidak "menambah/mengurangi" angka
   (rawan selisih), tetapi menghitung ulang satu kunci dari sumbernya. Aman dijalankan berkali-kali.
2. **UPDATE yang memindah kunci** (tanggal/outlet berubah) → hitung ulang kunci LAMA dan BARU.
3. **Kunci kosong → baris rekap dihapus.**
4. **Advisory lock per kunci** (`pg_advisory_xact_lock(hashtextextended(kunci,0))`) supaya dua
   event bersamaan (clock-in & clock-out) tidak saling timpa. Setelah lock, statement berikutnya
   memakai snapshot baru (READ COMMITTED) sehingga melihat baris transaksi sebelumnya.
5. **`SECURITY DEFINER` + `SET search_path = public`** pada fungsi trigger, lalu
   `REVOKE ALL … FROM PUBLIC, anon, authenticated` (tidak bisa dipanggil lewat API).
6. **Tabel rekap ber-RLS** yang **mencerminkan persis** policy SELECT tabel mentah.
   `REVOKE ALL` dari anon/authenticated, `GRANT SELECT` ke authenticated saja; tulis hanya via trigger.
7. **Backfill idempoten** di migration yang sama (loop `DISTINCT` kunci → fungsi hitung).
8. **Tanggal bisnis dalam WIB**: `(ts AT TIME ZONE 'Asia/Jakarta')::date`, dan batas rentang
   `ts >= (d::timestamp AT TIME ZONE 'Asia/Jakarta') AND ts < ((d+1)::timestamp AT TIME ZONE 'Asia/Jakarta')`
   (sargable → tetap memakai index).

Template: [`templates/tabel_rekap_trigger.sql`](templates/tabel_rekap_trigger.sql)

## Biaya tulis

Tambahan per event hanya satu upsert kecil (baca beberapa baris mentah via index kunci).
Untuk clock-in/out (ratusan per hari) tidak terasa. Untuk tabel dengan ribuan tulis per detik,
pertimbangkan agregasi berkala (cron) alih-alih trigger per baris.

## Hasil terukur (HR)

- Hasil tabel rekap **identik** dengan pengelompokan lama (dibandingkan angka per angka).
- Uji beban sintetis ±150 ribu hari-absen: halaman sebulan **7 ms**, 5 tahun **59 ms**,
  cari nama **4 ms**, rekap payroll sebulan **3 ms**.
