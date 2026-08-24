# Implementation Plan: Saldo Petty Cash Admin

## Task 1: Simpan override dan histori

**Acceptance criteria:**
- [ ] Shift terbaru menyimpan saldo saat ini hasil override.
- [ ] RPC hanya menerima role Admin, nominal nonnegatif, dan catatan terisi.
- [ ] Satu pemanggilan RPC memperbarui saldo serta menulis histori.

**Verification:** tinjau SQL, cek tipe RPC, dan jalankan pemeriksaan migration bila tersedia.

**Dependencies:** None
**Estimated scope:** Medium

## Task 2: Halaman pengaturan Admin

**Acceptance criteria:**
- [ ] Submenu baru tampil di grup Sistem untuk Admin.
- [ ] Admin memilih outlet sebelum form saldo tampil.
- [ ] Form mengubah Modal Awal dan Saldo Saat Ini dengan catatan wajib.
- [ ] Histori perubahan tampil dari terbaru.

**Verification:** type-check Admin Dashboard dan uji form terkait.

**Dependencies:** Task 1
**Estimated scope:** Medium

## Checkpoint: Admin

- [ ] Halaman memuat outlet dan shift terbaru.
- [ ] Simpan berhasil memperbarui kartu serta histori.
- [ ] Role non-Admin ditolak oleh database.

## Task 3: Pakai override di tampilan operasional

**Acceptance criteria:**
- [ ] Leader dan Area Manager membaca saldo override.
- [ ] POS Kasir/Crew menampilkan dan memakai saldo override untuk validasi pengeluaran.
- [ ] Halaman tutup shift memakai saldo override sebagai saldo sistem.
- [ ] Shift berikutnya membawa saldo terakhir sebagai modal awal.

**Verification:** type-check dan build Admin Dashboard serta POS Kasir.

**Dependencies:** Task 1
**Estimated scope:** Medium

## Task 4: Tes regresi

**Acceptance criteria:**
- [ ] Perhitungan lama tetap dipakai jika override belum ada.
- [ ] Nominal negatif dan catatan kosong ditolak.
- [ ] Realtime atau refetch memperbarui angka tanpa data basi.

**Verification:** test, type-check, dan build yang tersedia.

**Dependencies:** Tasks 2-3
**Estimated scope:** Small

## Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Saldo override berbeda dari rincian mutasi | Tinggi | Tandai sumber saldo sebagai perubahan Admin dan tampilkan catatannya |
| Shift baru mengabaikan override | Tinggi | Ubah fungsi pembukaan shift agar membawa saldo terakhir |
| Update hanya masuk ke salah satu tabel | Tinggi | Satukan update dan insert histori di dalam satu RPC |
| Tampilan lain masih menghitung saldo lama | Sedang | Cari seluruh pembaca `starting_petty_cash` dan sambungkan ke helper yang sama |
