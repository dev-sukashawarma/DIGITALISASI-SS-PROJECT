# Pembaruan Sistem Stock Opname (21 Juli 2026)

Dokumen ini merangkum perubahan dan perbaikan yang dilakukan pada sistem Opname untuk aplikasi Stok.

## Latar Belakang Masalah
1. **Error Database**: Sebelumnya muncul error `violates check constraint "opname_status_check"` saat aplikasi mencoba mengubah status opname menjadi `pending_approval` (karena ada selisih). Error ini muncul karena skema database (tabel `opname`) tidak mengizinkan nilai `pending_approval`.
2. **Fitur "Menunggu Leader" Tidak Terpakai**: Ternyata, sistem persetujuan Leader (`pending_approval`) memang tidak digunakan oleh tim operasional Gudang maupun Kitchen di lapangan. Fitur persetujuan ini sempat dimasukkan secara sepihak ke sistem pada pembaruan minggu lalu (commit `e0838301`), yang akhirnya menyebabkan alur opname tertahan di status "Menunggu" dan form menjadi terkunci (menolak diubah akibat RLS `opname_item`).

## Perubahan yang Dilakukan

### 1. Perbaikan Skema Database (Constraint)
Menambahkan status `pending_approval` dan `rejected` ke dalam `opname_status_check` di database Supabase agar sistem terhindar dari *crash* constraint. (Dilakukan via SQL Editor).

```sql
ALTER TABLE "public"."opname" DROP CONSTRAINT IF EXISTS "opname_status_check";
ALTER TABLE "public"."opname" ADD CONSTRAINT "opname_status_check" 
CHECK (status IN ('draft', 'pending_approval', 'finalized', 'rejected'));
```

### 2. Penghapusan Fitur "Menunggu Persetujuan Leader"
Kami telah **mencabut total** logika status `pending_approval` dari kode antarmuka. 

**Perubahan pada `apps/stok/src/components/stok/OpnameForm.tsx`**:
- Menghapus pengecekan kondisi `if (hasFlagged) { setPendingApproval(...) }`.
- Sistem kini melakukan bypass dan **langsung memanggil `finalize(opname.id)`** untuk semua form opname yang disubmit.
- Notifikasi "Menunggu Leader" sudah ditiadakan.

### 3. Reset Data Tes
Data draft dan opname "Menunggu Leader" milik Gudang Pusat yang tersangkut selama proses pengetesan hari ini telah dihapus sepenuhnya (di-reset) dari database agar crew dapat mengulangi input tanpa error RLS.

## Status Sistem Saat Ini
Seluruh jenis Opname dari semua outlet (Gudang, Kitchen, dsb.) sekarang akan **langsung ter-Finalisasi (Selesai)** begitu tombol Simpan ditekan, meskipun terdapat banyak selisih dalam inputan (sama seperti perilaku sistem sebelum adanya update `magic link approval`). Stok sistem akan langsung terpotong/terupdate, dan form akan dikunci dengan status aman `finalized`.
