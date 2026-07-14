# Auto-Toggle Menu Berdasarkan Stok Bahan Baku (BOM)

Fitur ini akan secara otomatis mematikan (gray-out) menu di Kiosk dan Kasir jika stok bahan baku (BOM) tidak mencukupi untuk membuat 1 porsi, dan otomatis menyalakannya kembali jika stok sudah mencukupi.

## 1. Pemisahan Status Manual dan Otomatis
Kasir saat ini memiliki kewenangan mematikan menu secara manual (misal: mesin rusak, atau sedang ramai). Untuk mencegah sistem menimpa pengaturan manual Kasir, kita akan memisahkan **Menu Habis karena Sistem (Stok)** dan **Menu Habis karena Kasir (Manual)**. Keduanya akan digabungkan (merge) di tampilan layar, sehingga:
- Jika kasir mematikan manual -> Menu mati.
- Jika stok habis -> Menu mati.
- Jika kasir menyalakan DAN stok ada -> Menu nyala.

## 2. Threshold "Habis"
Sesuai kesepakatan, menu akan mati JIKA stok riil `< qty_per_porsi`. (Bukan mutlak 0, tapi tidak cukup untuk 1 porsi).

---

## 3. Detail Implementasi (Database Trigger)

Kita akan menggunakan solusi **Database Trigger (PostgreSQL)** yang berjalan instan secara gaib di server setiap kali tabel `stok_balance` berubah.

### Database / Supabase Migrations
**File baru:** `supabase/migrations/20260713000000_stok_menu_auto_toggle.sql`

1. Membuat fungsi PostgreSQL `calculate_auto_unavailable_menus(p_outlet_id)` yang mengecek semua resep di outlet tersebut. Jika ada bahan baku yang `stok_balance < qty_per_porsi`, maka `menu_item_ref` dicatat.
2. Menyimpan daftar menu yang habis otomatis ke dalam tabel `kiosk_settings` dengan kunci khusus: `auto_unavailable_menu_ids`.
3. Membuat Trigger pada tabel `stok_balance` (`AFTER INSERT OR UPDATE`) yang akan memanggil fungsi di atas secara otomatis.

---

## 4. Perubahan Frontend Kiosk (Pelanggan)

### File: `apps/pos-kasir/app/page.tsx`
- Menambahkan pengambilan data setting `auto_unavailable_menu_ids` dari server saat render pertama (SSR) Kiosk agar tampilan awal langsung menyesuaikan stok.
- Menggabungkan daftar `unavailable_menu_ids` (manual kasir) dengan `auto_unavailable_menu_ids` (sistem stok).

### File: `apps/pos-kasir/app/KioskMenuClient.tsx`
- Menambahkan *Realtime Listener* untuk mendengarkan perubahan pada `auto_unavailable_menu_ids` dari database.
- Jika stok berubah dan trigger berjalan, Kiosk akan **langsung meredupkan menu dalam hitungan milidetik** tanpa perlu *refresh* halaman.

---

## 5. Perubahan Frontend Kasir (POS Kasir)

Memastikan daftar menu di dalam mode pesanan Manual/POS Kasir (jika ada) juga memblokir menu yang secara otomatis habis karena stok. (Kasir tidak bisa memesan jika bahan baku kurang).

---

## 6. Skenario Pengujian (Verification Plan)

1. **Jalankan Migrasi:** Terapkan file SQL ke database Supabase.
2. **Habiskan Stok:** Ubah stok bahan baku A (yang dipakai di Menu X) menjadi 0 melalui sistem stok.
3. **Cek Layar Kiosk:** Buka layar Kiosk, pastikan Menu X otomatis mati (*disable/grayed out*).
4. **Isi Kembali Stok:** Tambah kembali stok bahan baku A menjadi lebih dari `qty_per_porsi`.
5. **Cek Layar Kiosk:** Pastikan Menu X otomatis menyala kembali tanpa perlu *refresh* browser.
