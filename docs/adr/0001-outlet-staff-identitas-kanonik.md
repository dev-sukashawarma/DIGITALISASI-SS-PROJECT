# ADR-001 — `outlet_staff` sebagai identitas kanonik orang di outlet

- Status: Accepted
- Tanggal: 2026-06-09

## Konteks
Di ekosistem existing ada beberapa konsep "orang outlet" yang terpisah: `pos_cashiers` (POS SS lama, role kasir/spv) dan `admin_users` (TiktokGo, role super_admin/outlet_staff). Suite baru butuh atribusi orang yang konsisten untuk absensi, stok, dan verifikasi penerimaan. Owner juga akan meng-upload **POS/Kasir baru** terpisah nanti.

## Keputusan
Definisikan satu entitas kanonik **`outlet_staff`** sebagai sumber kebenaran identitas orang di outlet (role: `crew | kasir | spv | kepala_outlet`). Semua aksi outlet (absen, transaksi, stok, terima kiriman) ber-aktor `outlet_staff`. POS baru nanti **link** ke `outlet_staff`, bukan bikin tabel orang sendiri. Suite baru **tidak kopling** ke `pos_cashiers` lama.

## Alternatif yang ditolak
- **Pakai ulang `pos_cashiers`** sebagai identitas — ditolak: POS baru belum ada, dan absensi mencakup himpunan lebih luas (semua crew), bukan hanya kasir.
- **Akun terpisah per sistem** — ditolak: data orang terpecah di 3+ sistem, atribusi dashboard owner jadi tidak akurat, sinkronisasi mahal.

## Konsekuensi
- (+) Atribusi per-orang konsisten lintas modul; dashboard owner akurat.
- (+) POS baru tinggal referensi `outlet_staff`.
- (−) Perlu migrasi/mapping saat POS baru di-upload (memetakan kasir ke `outlet_staff`).
