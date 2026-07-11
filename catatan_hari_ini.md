# Catatan Pengembangan Kasir - Hari Ini

Dokumen ini berisi rangkuman fitur apa saja yang berhasil diselesaikan hari ini dan fitur apa yang masih tertunda/belum selesai.

## ✅ Fitur yang Sudah Selesai (Selesai Hari Ini)

1. **Redesain Popup Pengingat 20 Menit (Pesanan Terjadwal)**
   - UI dirombak total menjadi mirip desain *Card Antrean* agar lebih rapi dan konsisten.
   - Menambahkan foto thumbnail/gambar menu ke dalam modal dengan memanggil `image_url` langsung dari Supabase.
   
2. **Sistem Alarm Bertingkat (Escalation / Snooze System)**
   - Menambahkan aturan paksaan (forcing function): jika sisa waktu menuju pengambilan (pickup) tinggal 10 menit dan pesanan belum berstatus SELESAI, sistem akan memunculkan peringatan darurat berwarna merah yang memaksa kasir untuk segera menyelesaikannya.

3. **Smart Indicator "Dapur Sibuk" & Batch Cooking Assistant**
   - **Perhitungan Berbasis Porsi:** Sistem tidak lagi menggunakan patokan jumlah pesanan/nota, tetapi otomatis menghitung akumulasi *quantity* per menu.
   - **Peringatan Spesifik (> 7 porsi):** Alarm Dapur Sibuk hanya akan menyala jika ada *salah satu menu* yang menumpuk melebihi 7 porsi di antrean masak, agar tidak sekadar berkedip saat dapur masih terkendali.
   - **Rangkuman Menu Menumpuk:** Sistem otomatis menampilkan nama menu apa saja yang melampaui batas tersebut, untuk memudahkan kru melakukan *batch cooking* (masak massal).
   - **Global Tracking (Baru Saja Diperbaiki):** Perhitungan "Dapur Sibuk" ini dibuat global, yang artinya mau kasir sedang membuka tab "Offline", "Online", maupun "Semua", peringatan ini tetap memperhitungkan **seluruh pesanan aktif di dapur**.

---

## ⏳ Fitur / Pekerjaan yang Belum Selesai (Pending)

1. **Uji Coba Lapangan untuk Audio & Notifikasi**
   - Browser modern memiliki aturan ketat mengenai pemutaran audio otomatis (autoplay policy). Meskipun sistem "Unlock Audio" sudah diterapkan, masih butuh pengujian lapangan pada *device* fisik tablet kasir untuk memastikan suara dering alarm darurat benar-benar tembus saat 10 menit terakhir.

2. **Penanganan Kasus Tab/Aplikasi Kasir Tertidur (Sleep Mode)**
   - Saat ini perhitungan waktu mundur (20 menit dan 10 menit) sangat bergantung pada berjalannya aplikasi kasir di browser. Jika layar iPad/Tablet kasir mati (sleep) cukup lama, ada kemungkinan perhitungan interval *timer* tertunda. Mungkin perlu dikembangkan *Service Worker* atau integrasi PWA yang lebih kuat di masa depan.

3. **Penyesuaian Batas Threshold "Dapur Sibuk" secara Dinamis**
   - Saat ini batas porsi di-hardcode ke angka `> 7 porsi`. Ke depannya mungkin restoran ingin bisa mengubah batas ini langsung dari halaman "Pengaturan Admin" (misalnya saat hari libur dinaikkan jadi 10 porsi, hari biasa 5 porsi). Belum ada halaman pengaturan untuk ini.
