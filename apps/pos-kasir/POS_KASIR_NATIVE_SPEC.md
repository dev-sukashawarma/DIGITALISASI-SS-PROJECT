# SPESIFIKASI TEKNIS & ALUR LOGIKA BISNIS SISTEM POS KASIR
## Dokumentasi Porting Aplikasi Native (Android Kotlin)

**Project:** Suka Shawarma POS Kasir (Multi-Outlet)  
**Versi Spesifikasi:** 1.0.0  
**Tujuan:** Panduan Arsitektur & Logika Bisnis untuk Pembuatan Aplikasi Native Android (Kotlin)  

---

## 1. Ringkasan Eksekutif & Tujuan

Dokumen ini berisi spesifikasi teknis lengkap, aturan bisnis (*business rules*), skema data, alur kerja (*workflows*), dan mekanisme integrasi hardware dari sistem **POS Kasir Suka Shawarma**. Dokumentasi ini dirancang agar tim pengembang aplikasi Native Android (menggunakan **Kotlin**) dapat membangun ulang / membuat cangkang native dengan 100% presisi logika tanpa ada fitur yang terlewat.

### Target Kemampuan Native Kotlin:
1. **Performa & Responsivitas Tinggi**: Antarmuka UI kasir tanpa lag dan mendukung pengoperasian layar sentuh (*touchscreen*) cepat.
2. **Koneksi Bluetooth Printer Persistent**: Soket Bluetooth ESC/POS thermal printer dikelola secara native di background service sehingga tidak pernah terputus saat aplikasi di-refresh/di-background.
3. **Sistem Offline-First**: Kasir tetap dapat melakukan transaksi saat jaringan internet mati (menggunakan local database Room & queue sync engine).
4. **Push Notification Native**: Notifikasi pesanan baru (dari Kiosk/Online) masuk via Firebase Cloud Messaging (FCM) dan membunyikan alarm kasir.

---

## 2. Arsitektur Aplikasi Target (Kotlin Android)

### A. Pola Arsitektur Native:
* **Architecture Pattern**: MVVM (Model-View-ViewModel) + Clean Architecture.
* **UI Framework**: Jetpack Compose (atau Android XML Layout dengan Material Design 3).
* **Asynchronous & Concurrency**: Kotlin Coroutines & StateFlow / SharedFlow.
* **Database Lokal (Offline)**: **Room Database** (menggantikan IndexedDB / Dexie.js di web).
* **Networking & Web API**: Retrofit 2 + OkHttp3 atau Supabase Kotlin SDK (PostgREST, Auth, Realtime Channels).
* **Dependency Injection**: Hilt / Koin.

### B. Integrasi Hardware Native:
1. **Bluetooth Thermal Printer (ESC/POS)**:
   * Menggunakan `BluetoothSocket` (RFCOMM / SPP / GATT) Android Native.
   * Format cetak: Command byte ESC/POS (Align, Bold, Double Height, Paper Cut, Raster Logo).
   * Fallback: Intent URI Scheme ke aplikasi **RawBT** (`rawbt:base64,...`).
2. **Alert Suara & Haptic**:
   * `MediaPlayer` / `SoundPool` untuk suara alarm *"Pesanan Masuk!"*.
   * `Vibrator` Android SDK untuk haptic feedback tombol kasir.
3. **Layar Tambahan (Customer Display)**:
   * Mampu memanfaatkan `Presentation` API Android untuk menampilkan total belanja di layar kedua kasir.

---

## 3. Autentikasi, Otorisasi (RBAC) & Multi-Outlet Isolation

### A. Role-Based Access Control (RBAC)
Sistem mengenali 4 jenis role utama pada tabel `profiles`:
1. `admin`: Memiliki akses penuh ke seluruh outlet, pengaturan master produk, harga, dan laporan keuangan.
2. `leader` / `spvkitchen`: Supervisor cabang, dapat mengelola shift, cancel order, dan stok habis.
3. `crew` / `cashier`: Kasir operasional, menginput transaksi, memproses antrean, dan mencetak struk.
4. `kiosk`: Sesi khusus untuk tablet self-order pelanggan di outlet.

### B. Multi-Outlet Isolation
Setiap transaksi dan data produk terikat pada `outlet_id` (UUID).
* **Aturan Kritis**: Setiap query ke database (baik `orders`, `menu_items`, `outlet_promos`, mau pun `kiosk_settings`) **WAJIB** menyertakan parameter `WHERE outlet_id = current_user_outlet_id`. Kasir di Outlet A tidak boleh melihat atau mengubah pesanan dari Outlet B.

### C. Mekanisme Pairing Kiosk (Tanpa Login Manual)
1. Kasir di POS membuka halaman *Settings Kiosk* dan menekan *"Generate Kode Pairing"* (6-digit acak).
2. Tablet Kiosk memasukkan kode 6-digit tersebut.
3. Server memverifikasi kode di tabel `kiosk_pairing_code`, mengembalikan token & `outlet_id` cabang terkait, kemudian mengikat tablet tersebut secara permanen ke outlet tersebut.

---

## 4. Alur Manajemen Pesanan (Order Flow & Lifecycle)

Sistem membedakan 3 sumber utama pesanan (`source`):

```text
       ┌────────────────────────────────────────────────────────┐
       │                 SUMBER PESANAN (SOURCE)                │
       └───────┬───────────────────┬────────────────────┬───────┘
               │                   │                    │
               ▼                   ▼                    ▼
       ┌───────────────┐   ┌───────────────┐    ┌───────────────┐
       │ Kasir Walk-in │   │ Tablet Kiosk  │    │ Online Order  │
       │ (pos/manual)  │   │ (self-order)  │    │(Grab/Go/Shop) │
       └───────┬───────┘   └───────┬───────┘    └───────┬───────┘
               │                   │                    │
               └───────────────────┼────────────────────┘
                                   │
                                   ▼
                   ┌───────────────────────────────┐
                   │ STATUS: pending               │
                   │ (Menunggu Pembayaran / Dapur) │
                   └───────────────┬───────────────┘
                                   │ [Tombol: Mulai Masak]
                                   ▼
                   ┌───────────────────────────────┐
                   │ STATUS: preparing             │
                   │ (Sedang Dimasak di Dapur)     │
                   └───────────────┬───────────────┘
                                   │ [Tombol: Pesanan Siap / Selesai]
                                   ▼
                   ┌───────────────────────────────┐
                   │ STATUS: completed / ready     │
                   │ (Pesanan Selesai / Lunas)     │
                   └───────────────┬───────────────┘
```

### A. Status Pesanan (Order Status Lifecycle)
* `pending`: Pesanan baru dibuat, belum dibayar (atau menunggu diproses dapur).
* `preparing`: Dapur/Kasir mulai memasak pesanan.
* `ready`: Makanan sudah matang dan siap diambil pelanggan.
* `completed`: Transaksi selesai, makanan sudah diserahkan, pembayaran lunas.
* `cancelled`: Pesanan dibatalkan (memerlukan persetujuan Leader/SPV).

### B. Papan Utama Kasir (3-Column Dashboard)
Antarmuka utama kasir dibagi menjadi 3 kolom status antrean realtime:

1. **Kolom 1: Menunggu Pembayaran / Baru (`pending`)**
   * Menampilkan pesanan masuk dari Kiosk, Online, atau Kasir.
   * Kasir dapat menekan tombol **"Bayar / Mulai Masak"** untuk mengubah status ke `preparing`.
   * Struk Dapur (*Kitchen Receipt*) dapat otomatis dicetak saat masuk ke status ini.

2. **Kolom 2: Sedang Diproses (`preparing`)**
   * Menampilkan daftar pesanan yang sedang dimasak di dapur.
   * Dilengkapi indikator waktu pembuatan (*Preparation Time Tracker*).
   * Tombol **"Pesanan Siap / Selesai"** mengubah status ke `completed`.

3. **Kolom 3: Riwayat Hari Ini (`completed`)**
   * Menampilkan daftar pesanan lunas hari ini.
   * Dilengkapi kolom pencarian nomor antrean (*Queue Search*).
   * Fitur **Cetak Ulang Struk** (Struk Customer / Struk Dapur).

---

## 5. Logika Transaksi & Kalkulator Promo

### A. Struktur Item Keranjang (Cart State)
Setiap item dalam keranjang belanja memiliki komponen:
* `menu_item_id` (UUID)
* `name` (Nama Menu)
* `quantity` (Jumlah)
* `unit_price` (Harga Satuan)
* `subtotal` (`unit_price * quantity`)
* `note` (Catatan khusus, misal: *"Tanpa Bawang, Pedas"*).
* `is_child` (Boolean, jika item ini merupakan Add-on/Extra dari menu utama). Format penyimpanan nama di database untuk note: `Nama Menu|NOTE|Catatan`.

### B. Kalkulasi Promo (`outlet_promos`)
Sistem mendukung 2 cakupan promo (*scope*) dan 2 jenis diskon (*discount_type*):

1. **Scope Promo**:
   * `global`: Diskon berlaku untuk total seluruh nilai belanjaan.
   * `item`: Diskon berlaku khusus pada menu tertentu (`menu_item_id`).

2. **Jenis Diskon**:
   * `percentage`: Diskon berupa persentase (misal: 10%). Hitungan: `Subtotal * (percentage / 100)`.
   * `nominal`: Diskon nilai tetap Rupiah (misal: Rp 5.000).

3. **Rumus Total Akhir**:
   $$\text{Subtotal} = \sum (\text{unit\_price} \times \text{quantity})$$
   $$\text{Total Diskon} = \text{Diskon Global} + \sum \text{Diskon Item}$$
   $$\text{Total Bayar} = \max(0, \text{Subtotal} - \text{Total Diskon})$$

### C. Metode Pembayaran
* `cash` (Tunai): Kasir memasukkan `amount_received` (Uang Diterima). Sistem otomatis menghitung `change_amount = amount_received - total_amount`.
* `qris` (QRIS BCA / Dinamis): Menampilkan QR Code bayar di layar, otomatis terverifikasi via webhook/realtime.
* `card` (Debit/Kredit): Pembayaran melalui EDC.

---

## 6. Spesifikasi Engine Cetak Thermal (ESC/POS & Bluetooth)

Aplikasi Kotlin harus mampu mencetak 2 jenis struk ke printer thermal (lebar 58mm = 32 karakter per baris, atau 80mm = 48 karakter per baris).

### A. Struk Customer (Struk Belanja Pelanggan)
```text
========================================
             SUKA SHAWARMA              
             Cabang Sudirman            
========================================
24/07/2026 14:30                   TUNAI
Pelanggan: Ahmad
Kasir: Budi
----------------------------------------
                 No. 15                 
----------------------------------------
2x Chicken Shawarma           Rp 70.000
   - Pedas sedang
1x French Fries               Rp 20.000
----------------------------------------
Subtotal                      Rp 90.000
Diskon                       -Rp 10.000
TOTAL                         Rp 80.000
Tunai                        Rp 100.000
Kembalian                     Rp 20.000
----------------------------------------
  Terima kasih & selamat menikmati!     
========================================
```

### B. Struk Dapur (Kitchen Receipt)
```text
========================================
              STRUK DAPUR               
----------------------------------------
24/07/2026 14:30
Pelanggan: Ahmad
----------------------------------------
                 No. 15                 
----------------------------------------
2x Chicken Shawarma
   - Pedas sedang
1x French Fries
========================================
```

### C. Perintah Byte ESC/POS Native (Kotlin)
* **Initialize**: `0x1B, 0x40`
* **Align Center**: `0x1B, 0x61, 0x01` | **Align Left**: `0x1B, 0x61, 0x00`
* **Bold On**: `0x1B, 0x45, 0x01` | **Bold Off**: `0x1B, 0x45, 0x00`
* **Double Height (Nomor Antrean)**: `0x1D, 0x21, 0x11`
* **Paper Cut**: `0x1D, 0x56, 0x41, 0x00`
* **Transmission Chunking**: Pengiriman byte Bluetooth dibagi menjadi chunk 128 bytes dengan delay 25ms agar printer thermal murah tidak crash/loss buffer.

---

## 7. Arsitektur Offline-First & Queue Synchronization Engine

Ketika koneksi internet terputus di outlet, kasir **tetap harus bisa melayani transaksi**.

```text
[ Input Transaksi Kasir ]
           │
           ├───► (Internet ONLINE) ────► Langsung Kirim ke Supabase REST API
           │
           └───► (Internet OFFLINE) ───┐
                                       ▼
                       ┌───────────────────────────────┐
                       │   Simpan ke Room DB Local     │
                       │ - Table: local_orders         │
                       │ - Nomor Antrian: Start 9001   │
                       └───────────────┬───────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │   Queue Sync Engine (Kotlin)  │
                       │ - Deteksi status Network      │
                       │ - Auto Retry saat Online      │
                       └───────────────────────────────┘
```

### A. Penomoran Antrean Lokal (Offline Range)
* Nomor antrean resmi dari server berurutan (misal: 1, 2, 3, ...).
* Nomor antrean offline lokal dimulai dari angka **9001** (misal: 9001, 9002, ...) untuk mencegah bentrok/duplikasi dengan nomor antrean resmi server saat disinkronkan kemudian.

### B. Tabel Database Room Local (Android)
1. `local_orders`: Menyimpan data transaksi offline secara utuh agar langsung muncul di papan order kasir.
2. `sync_queue_orders`: Menyimpan antrean payload API yang belum terkirim ke server.
3. `sync_queue_mutations`: Menyimpan antrean perubahan status (misal: perubahan status `pending` ke `preparing` yang dilakukan saat offline).

---

## 8. Shift Kasir, Cash Drawer & Petty Cash

### A. Manajemen Shift Kasir (`/kasir/shift`)
1. **Start Shift (Buka Kasir)**:
   * Kasir menginput **Modal Awal Laci** (misal: Rp 500.000).
   * Sistem mencatat timestamp `shift_start`.
2. **End Shift (Tutup Kasir)**:
   * Sistem menghitung otomatis:
     $$\text{Total Tunai Sistem} = \text{Modal Awal} + \text{Penjualan Tunai} - \text{Petty Cash Out}$$
   * Kasir memasukkan **Uang Fisik di Laci** (Hasil Hitung Fisik).
   * Sistem menghitung **Selisih (Nombok/Surplus)**:
     $$\text{Selisih} = \text{Uang Fisik Laci} - \text{Total Tunai Sistem}$$
   * Mencetak Struk Rekapitulasi Shift Kasir.

### B. Petty Cash (Uang Kas Kecil)
Pencatatan pengeluaran darurat outlet (contoh: Beli es batu, galon air, parkir):
* Bidang input: `amount` (Nominal), `category` (Kategori), `notes` (Keterangan), `receipt_image_url` (Foto Struk).
* Memotong nilai estimasi tunai di laci kasir saat perhitungan akhir shift.

---

## 9. Logika Perhitungan Bonus Crew (PostgreSQL RPC Engine)

Target omset harian outlet diatur dalam tabel `daily_sales_targets`.

### Aturan Bisnis Bonus Crew:
1. **Target Omset Harian**: Ditentukan per outlet (`target_amount`) beserta nominal bonusnya (`bonus_amount`).
2. **Kriteria Pencapaian**: Total penjualan bersih (`orders.total_amount` status `completed`) pada tanggal tersebut $\ge$ `target_amount`.
3. **Pembagian Bonus (Equal Split)**: Total akumulasi bonus harian selama 1 bulan dibagi rata kepada seluruh crew yang terdaftar di outlet tersebut pada tabel `outlet_staff` / `profiles`.

$$\text{Bonus Per Crew} = \frac{\sum (\text{Bonus Harian Tercapai})}{\text{Jumlah Total Crew Terdaftar di Outlet}}$$

---

## 10. Skema Database Utama (Supabase PostgreSQL)

Berikut ringkasan tabel utama yang harus dipetakan oleh aplikasi Kotlin Native (via Supabase SDK / Retrofit):

### 1. `outlets`
* `id` (UUID, PK)
* `name` (TEXT)
* `address` (TEXT)
* `phone` (TEXT)
* `type` (TEXT: 'owned' / 'mitra')
* `is_active` (BOOLEAN)

### 2. `profiles`
* `id` (UUID, PK, Ref `auth.users`)
* `role` (TEXT: 'admin' | 'crew' | 'leader' | 'kiosk')
* `outlet_id` (UUID, FK `outlets`)
* `username` (TEXT)

### 3. `categories` & `menu_items`
* `id` (UUID, PK)
* `category_id` (UUID, FK)
* `name` (TEXT)
* `price` (DECIMAL)
* `is_available` (BOOLEAN) — *Jika false, menu otomatis hilang dari Kasir & Kiosk*.
* `prep_time` (INTEGER) — *Estimasi waktu masak dalam menit*.

### 4. `orders` & `order_items`
* `id` (UUID, PK)
* `outlet_id` (UUID, FK)
* `order_number` (INTEGER / SERIAL)
* `customer_name` (TEXT)
* `status` (TEXT: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled')
* `payment_method` (TEXT: 'cash' | 'qris' | 'card')
* `total_amount` (DECIMAL)
* `discount_amount` (DECIMAL)
* `source` (TEXT: 'pos' | 'kiosk' | 'online')
* `kitchen_receipt_printed` (BOOLEAN)

### 5. `outlet_promos`
* `id` (UUID, PK)
* `outlet_id` (UUID, FK)
* `scope` (TEXT: 'global' | 'item')
* `menu_item_id` (UUID, Optional FK)
* `discount_type` (TEXT: 'percentage' | 'nominal')
* `discount_value` (DECIMAL)
* `is_active` (BOOLEAN)

---

## 11. Struktur Paket Android Kotlin yang Disarankan

Untuk implementasi aplikasi Native Android (Kotlin), disarankan menggunakan struktur folder berikut:

```text
com.sukashawarma.pos/
├── data/
│   ├── local/              // Room Database (local_orders, sync_queue)
│   │   ├── dao/
│   │   ├── entity/
│   │   └── AppDatabase.kt
│   ├── remote/             // Supabase Client / Retrofit API
│   │   ├── api/
│   │   └── dto/
│   ├── repository/         // Repository Implementation (Offline + Online)
│   └── bluetooth/          // ESC/POS Bluetooth Printer Driver
│       ├── ESCPosEncoder.kt
│       └── BluetoothPrinterManager.kt
├── di/                     // Hilt Dependency Injection Modules
├── domain/
│   ├── model/              // Data models (Order, MenuItem, Promo)
│   └── usecase/            // Business Logic (CalculateTotal, SyncQueue, PrintReceipt)
└── presentation/           // UI Layer (Jetpack Compose / ViewModels)
    ├── dashboard/          // 3-Column Order Board
    ├── order_manual/       // Cart & Menu Selection
    ├── shift/              // Cashier Shift & Petty Cash
    ├── settings/           // Printer & Kiosk Pairing Setup
    └── theme/              // Design System (Color, Typography)
```

---

*Dokumen ini merupakan spesifikasi resmi dan acuan utama logika bisnis untuk pengembangan aplikasi Native Kotlin POS Kasir Suka Shawarma.*
