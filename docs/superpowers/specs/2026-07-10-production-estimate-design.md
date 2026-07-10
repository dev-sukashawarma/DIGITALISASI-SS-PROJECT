# Design Spec: Estimasi Produksi Crew Dashboard

## 1. Goal
Menyediakan fitur prediksi/estimasi produksi pada halaman `CrewDashboard` agar crew di outlet dapat dengan cepat mengetahui berapa maksimal porsi Shawarma yang bisa dibuat berdasarkan ketersediaan sisa bahan baku saat ini. Fitur ini difokuskan sebagai panduan operasional shift.

## 2. Architecture & Components

### 2.1 UI Component (`ProductionEstimateWidget`)
- **Lokasi:** Ditambahkan pada komponen `CrewDashboard.tsx` di panel kolom kanan (Right Column: Alerts & Quick Actions), diletakkan tepat di atas bagian "Aksi Cepat".
- **Visual Design:**
  - Container menggunakan styling card (putih, rounded-2xl, border tipis, shadow-sm).
  - Terdapat judul "Estimasi Produksi" dengan ikon pendukung.
  - Terdapat daftar item menu utama (misal: Shawarma Besar, Shawarma Kecil).
  - Setiap item menu menampilkan estimasi maksimal porsi dalam angka tebal, dilengkapi dengan teks keterangan kecil yang menunjukkan bahan baku mana yang menjadi "bottleneck" (bahan yang paling membatasi jumlah porsi).

### 2.2 Logika Perhitungan (Logic Layer)
- **Komponen Logika:** Akan dibuatkan fungsi helper atau custom hook (misal: `useProductionEstimate` atau fungsi statis `calculateProductionEstimate(items, recipes)`).
- **Pemetaan Resep (Bill of Materials):**
  - Akan didefinisikan sebuah konstanta (mapping statis) resep sementara, karena ini adalah iterasi pertama.
  - Struktur data resep akan memetakan `menu_name` ke array of `{ bahan_baku_name, amount_required_per_portion }`.
- **Algoritma Perhitungan:**
  1. Terima input berupa daftar `items` bahan baku (berasal dari `useCrewMonitoringData`).
  2. Untuk setiap menu di mapping resep:
     - Iterasi setiap bahan yang dibutuhkan.
     - Cari stok `current_qty` dari bahan tersebut di dalam daftar `items`.
     - Hitung: `max_portions_for_ingredient = Math.floor(current_qty / amount_required_per_portion)`.
     - Lacak bahan mana yang menghasilkan angka `max_portions` terkecil (ini adalah bottleneck).
  3. Kembalikan objek/array berisi `menu_name`, `estimated_portions` (angka terkecil dari kalkulasi di atas), dan `limiting_ingredient_name`.

## 3. Data Flow
1. Data bahan baku yang ada (dari Supabase / hook `useCrewMonitoringData`) diumpankan (passed as props atau diakses via hook) ke `ProductionEstimateWidget`.
2. Widget menjalankan perhitungan menggunakan fungsi helper.
3. Hasil perhitungan langsung dirender di dalam antarmuka.

## 4. Error Handling & Edge Cases
- **Data Bahan Kosong/Habis:** Jika salah satu bahan utama yang dibutuhkan oleh sebuah resep memiliki qty 0 atau tidak ditemukan dalam daftar, maka kalkulasi porsi untuk menu tersebut akan otomatis menghasilkan angka 0 dan melabeli bahan tersebut sebagai bottleneck.
- **Loading State:** Menampilkan state skeleton (menggunakan komponen `<Skeleton />` yang sudah ada) jika data utama bahan baku masih dalam status `isLoading`.
- **Tidak Memengaruhi Kinerja Utama:** Kalkulasi dijalankan di *client-side* (browser) menggunakan perhitungan matematika dasar, sehingga tidak memberikan beban tambahan pada database atau server.
