# Rencana Pengembangan (Plan): Dashboard Leader

## 1. Pendahuluan
Dokumen ini berisi rancangan arsitektur dan spesifikasi fitur untuk **Dashboard Leader**. Peran "Leader" berbeda dengan "SPV" maupun "Admin". Seorang Leader bertanggung jawab penuh atas **satu outlet** secara spesifik dan bertugas memastikan kelancaran operasional harian, perputaran uang (kasir & *petty cash*), serta kru yang bertugas.

## 2. Akses & Keamanan (Access Control)
- **Role Based:** Akses hanya diberikan untuk pengguna (user) di tabel `profiles` atau `outlet_staff` yang memiliki `role === 'leader'`.
- **Outlet Scoped:** Setiap data yang dimuat di Dashboard Leader **wajib** disaring (*filter*) berdasarkan `outlet_id` milik Leader tersebut. Leader tidak boleh melihat data dari outlet lain.
- **Middleware:** Penambahan proteksi di `middleware.ts` untuk rute `/leader` agar otomatis di-redirect jika role bukan 'leader'.

## 3. Rencana Fitur Utama (Core Features)

Berdasarkan *best practice* operasional restoran/kios, berikut adalah rekomendasi fitur yang wajib ada di Dashboard Leader:

### A. Operasional & Keuangan Harian (Daily Operations)
1. **Monitoring Transaksi (Live):** Melihat pesanan masuk, total pendapatan hari ini, dan metode pembayaran yang digunakan secara *real-time*.
2. **Manajemen Shift Kasir:**
   - Melihat status *shift* saat ini (Buka/Tutup).
   - Memantau Modal Awal (*Starting Cash*) dan Kas Kecil (*Starting Petty Cash*).
   - Melihat ringkasan tutup *shift* (End of Day).

### B. Otorisasi & Persetujuan (Approvals)
1. **Persetujuan Top Up Petty Cash:** Kasir yang mengajukan tambah dana operasional (Petty Cash) akan masuk ke antrean *Pending* di Dashboard Leader, dan Leader bisa menyetujui (Approve) atau Menolak (Reject). *(Saat ini fitur ini masih menumpang di Dasbor Admin, nantinya harus dipindah/dibagikan ke Leader)*.
2. **Otorisasi Void / Refund (Opsional):** Manajemen PIN khusus Leader untuk memberikan izin saat kasir ingin membatalkan pesanan (saat ini sudah berjalan via *prompt* PIN, ke depannya riwayat *void* bisa dilihat di dashboard ini).

### C. Manajemen Fisik (Opsional / Tahap Selanjutnya)
1. **Pemantauan Stok (Inventory):** Laporan sisa stok bahan baku kritis (seperti daging shawarma, roti, saus).
2. **Jadwal & Absensi Kru:** Mengecek siapa kru kasir dan dapur yang sedang bertugas hari ini.

## 4. UI / UX Design (Tata Letak)
- **Mobile-First Design:** Karena Leader sering bergerak di area kerja (*on the floor*), antarmuka harus sangat ramah perangkat *mobile* (HP/Tablet). Tombol harus besar (*thumb-friendly*).
- **Notifikasi Cepat:** Terdapat *badge* notifikasi merah di menu jika ada Top Up Petty Cash yang perlu segera disetujui.
- **Navigasi Bawah (Bottom Navigation):** Menggunakan pola aplikasi *mobile* dengan tab di bawah layar (misal: *Home*, *Transaksi*, *Approval*, *Profil*) agar mudah diakses menggunakan satu tangan.

## 5. Langkah-Langkah Implementasi (Implementation Steps)
1. **Persiapan Database:** Pastikan skema *user/staff* sudah memetakan akun `role = 'leader'` dengan satu `outlet_id`.
2. **Pembuatan Routing:** Buat folder `app/leader` beserta `layout.tsx` khusus untuk membungkus halaman Leader.
3. **Pengembangan UI Components:** Buat *Card* ringkasan pendapatan, tabel persetujuan *petty cash*, dan daftar riwayat *shift*.
4. **Integrasi Data:** Gunakan Supabase untuk menarik data khusus `outlet_id` sang Leader.
5. **Testing:** Uji coba masuk dengan berbagai *role* untuk memastikan Admin tetap bisa melihat semua, sedangkan Leader hanya bisa melihat outletnya sendiri.

---
*Catatan: Dokumen ini disimpan sebagai acuan. Saat tiba waktunya untuk memulai pengerjaan Dashboard Leader, AI/Developer tinggal membaca dokumen ini dan langsung melakukan eksekusi kode lapis demi lapis.*
