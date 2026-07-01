# Siklus Operasional Hulu ke Hilir (Technical Use Case)
Dokumen ini mengilustrasikan aliran data dan uang (Money & Data Flow) Suka Shawarma secara mendetail. Skenario ini dipetakan langsung ke struktur tabel, RPC (Remote Procedure Call), Views pada Supabase, **dan menggunakan master bahan baku riil dari database Suka Shawarma**.

## Konteks Skenario
- **Lokasi**: Outlet Cabang Empang (ID Outlet terikat via `accessible_outlet_ids()`)
- **Aktor (Sesuai `outlet_staff_role_check`)**: 
  - **Andi (Role: `crew`)**: Staf kasir & inventaris depan.
  - **Budi (Role: `kitchen`)**: Staf dapur.
  - **Pak Tono (Role: `spv`)**: SPV Kitchen yang berhak menyetujui surat jalan.
  - **Pak Bos (Role: `owner`)**: Pemilik bisnis (akses ke semua outlet).
  - **Pak Reza (Role: `mitra`)**: Investor khusus Cabang Empang.

---

## 1. HULU: Pengadaan (Permintaan ➡️ Surat Jalan ➡️ Stok)

### A. Permintaan Bahan (Purchase Requisition)
- **Aksi (UI)**: Andi (`crew`) membuka halaman `/stok/permintaan` di Crew Dashboard. Ia menginput daftar permintaan stok yang bervariasi karena menipis:
  - `30 kg AYAM`
  - `20 pack KULIT 25`
  - `5 crt MAYONES`
  - `10 kg LETTUCE`
- **Sistem (Database)**: 
  Sistem mengeksekusi RPC `buat_permintaan_svc` (Service Role bypass) yang meng-insert baris baru ke tabel `permintaan_bahan` (status: `pending`) dan 4 baris detail item tersebut ke tabel `permintaan_bahan_item`.

### B. Persetujuan & Surat Jalan (Fulfillment)
- **Aksi (UI)**: Pak Tono (`spv` / SPV Kitchen) menyetujui permintaan tersebut secara utuh dan mencetak *Surat Jalan*.
- **Sistem (Database)**: 
  - Sistem memanggil RPC `approve_permintaan_svc`.
  - Sistem membuat baris di tabel `surat_jalan` dan memindahkan item ke `surat_jalan_item`.
  - **CRITICAL TRIGGER**: Trigger `trg_fill_harga_snapshot` berjalan. Trigger ini menyalin master `bahan_baku_harga` hari ini ke kolom `surat_jalan_item.harga_snapshot`. 
    - *AYAM*: Rp 40.000 / kg
    - *KULIT 25*: Rp 25.000 / pack
    - *MAYONES*: Rp 150.000 / crt
    - *LETTUCE*: Rp 20.000 / kg
  - Total nilai aset Surat Jalan (HPP Awal) ini terkunci di angka **Rp 2.650.000**.

### C. Penerimaan Fisik di Outlet
- **Aksi (UI)**: Barang tiba. Andi (`crew`) menekan tombol "Terima Kiriman".
- **Sistem (Database)**:
  - Tabel `stok_balance` untuk Cabang Empang bertambah sesuai *qty* di atas.
  - Tabel `ledger_stok` mencatat *inflow* 4 baris dengan tipe `terima_kiriman`.

---

## 2. TENGAH: Operasional Shift Kasir & Pengeluaran (Cash Flow)

### A. Buka Shift (Open Shift)
- **Aksi (UI)**: Pukul **12:30**, Andi membuka layar POS dan menginput **Petty Cash** (Modal Awal) sebesar Rp 200.000.
- **Sistem (Database)**:
  Sistem memanggil RPC `open_shift(outlet_id, 200000)`. Terbuat satu baris di tabel `shifts` dengan status `open` dan `starting_cash` (sebagai Petty Cash) = 200000.

### B. Transaksi Penjualan
- **Aksi (UI)**: Andi melayani pembeli dan menerima berbagai pesanan. Sistem menerima seluruh jenis sumber *revenue*:
  - Pesanan POS (Dine-in/Take-Away) via **Tunai**: Rp 300.000
  - Pesanan POS (Dine-in/Take-Away) via **QRIS**: Rp 150.000
  - Pesanan POS (Dine-in/Take-Away) via **Kartu (Card)**: Rp 100.000
  - Pesanan via **GoFood**: Rp 200.000
  - Pesanan via **GrabFood**: Rp 150.000
  - Pesanan via **ShopeeFood**: Rp 100.000
  - Pesanan via **TikTok**: Rp 100.000
- **Sistem (Database)**:
  - Transaksi masuk ke tabel `orders` dan `order_items` (via `pos_sales_sync`).
  - Kolom `sales_source` terisi akurat (`pos`, `gofood`, `grabfood`, `shopeefood`, `tiktok`).
  - Kolom `payment_method` terisi `'cash'`, `'qris'`, atau `'card'`.
  
> [!NOTE]
> **Catatan Pemotongan Stok (BOM)**: Secara teori stok bahan seperti AYAM, KULIT, dan LETTUCE akan terpotong sesuai resep. Namun, karena saat ini fitur **BOM (Bill of Materials)** kita belum sepenuhnya berjalan (tahap M2), maka sistem POS *tidak otomatis memotong bahan*. Pemotongan stok bahan baku dan perhitungan HPP saat ini murni bergantung pada hasil "Opname Fisik" harian.

### C. Pengeluaran Outlet (Petty Cash Expense)
- **Aksi (UI)**: Gas 3Kg habis di tengah jalan. Budi meminta tolong dibelikan darurat di warung sebelah. Andi menginput pengeluaran Rp 25.000 (Kategori: `bahan_baku`, Item: `GAS 3Kg`) dan mengambil uang fisik dari laci *petty cash*.
- **Sistem (Database)**:
  - Baris baru masuk ke tabel `expenses` dengan `category` = `'bahan_baku'`, `amount` = 25000, `payment_source` = `'cash_drawer'`.
  - **CRITICAL TRIGGER**: Trigger `trg_link_expense_to_shift` menautkan pengeluaran ini secara otomatis ke `shift_id` milik Andi yang sedang aktif. Target uang tunainya otomatis dikurangi.

---

## 3. HILIR: Tutup Buku, Blind Close, dan HPP (End of Day)

### A. Tutup Shift (Blind Close)
- **Aksi (UI)**: Pukul 22:00, Andi menekan Tutup Shift. Sistem meminta Andi menghitung fisik uang tunai di laci tanpa membocorkan target. Andi menginput Rp 475.000.
- **Sistem (Database)**:
  - Sistem memanggil RPC `close_shift_blind(shift_id, 475000)`.
  - Fungsi internal `get_expected_shift_cash(shift_id)` berjalan: 
    *Rumus: `Petty Cash` (200.000) + Sum dari orders cash (300.000) - Sum dari expenses cash_drawer untuk GAS 3Kg (25.000) = **475.000**.*
  - Karena Aktual (475.000) = Expected (475.000), kolom `variance` mencetak angka **0**. Uang disetor dengan aman.

### B. Opname Harian Fisik
- **Aksi (UI)**: Budi (`kitchen`) menghitung fisik bahan baku di malam hari dan men-submit form Opname:
  - Sisa `AYAM`: 25 kg *(5 kg terpakai/hilang)*
  - Sisa `KULIT 25`: 15 pack *(5 pack terpakai/hilang)*
  - Sisa `MAYONES`: 4 crt *(1 crt terpakai/hilang)*
  - Sisa `LETTUCE`: 8 kg *(2 kg terpakai/hilang)*
- **Sistem (Database)**:
  - Tabel `opname` (tipe: `harian`) tersimpan.
  - *Ledger adjustment* otomatis dieksekusi jika `qty_fisik` beda dengan `stok_balance` harian.

---

## 4. AGREGASI DATA: Admin Dashboard (Profitabilitas Real-Time)

Keesokan harinya, saat Pak Bos (`owner`) dan Pak Reza (`mitra`) membuka `/dashboard/owner`, sistem memanggil rentetan *View* dan *RPC* otomatis:

1. **Agregasi Omzet (`sales_daily_scoped`)**
   Sistem menjumlahkan total seluruh sumber pesanan (Tunai, QRIS, Card, GoFood, GrabFood, ShopeeFood, TikTok). Pak Reza hanya melihat Cabang Empang berkat `accessible_outlet_ids()`. 
   Total Omzet = **Rp 1.100.000**.
2. **Kalkulasi HPP Aktual (`get_hpp_periode(from, to)`)**
   Sistem membaca opname Budi dan menghitung uang riil bahan yang hilang *(Nilai Masuk - Sisa Opname Fisik)*. Ini menyiasati ketidakadaan BOM:
   - *AYAM HPP*: 5 kg × Rp 40.000 = Rp 200.000
   - *KULIT 25 HPP*: 5 pack × Rp 25.000 = Rp 125.000
   - *MAYONES HPP*: 1 crt × Rp 150.000 = Rp 150.000
   - *LETTUCE HPP*: 2 kg × Rp 20.000 = Rp 40.000
   - **Total HPP Aktual = Rp 515.000**
3. **Agregasi Pengeluaran (`expenses_select_scoped`)**
   Pengeluaran darurat `GAS 3Kg` yang diinput Andi tercatat = **Rp 25.000**.
4. **Finalisasi Laba Bersih (UI Calculation)**
   Dasbor merekap angka di atas untuk mencetak Profitabilitas riil:
   - *Gross Profit* = Omzet (Rp 1.100.000) - HPP (Rp 515.000) = **Rp 585.000**.
   - *Net Profit* = Gross Profit (Rp 585.000) - Expenses (Rp 25.000) = **Rp 560.000**.
   
Alur hulu-ke-hilir ini memastikan sistem akuntansi tertutup (*closed-loop accounting*) di mana manipulasi omzet atau aset stok mustahil disembunyikan.
