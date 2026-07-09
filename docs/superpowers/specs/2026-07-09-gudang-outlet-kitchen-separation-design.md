# Design Spec: Pemisahan Entitas Gudang Pusat dan Outlet Kitchen

## Konteks
Gudang Pusat (Central Warehouse) dan Outlet Kitchen berada di satu lokasi fisik yang sama. Outlet Kitchen berfungsi ganda: sebagai titik produksi/stok untuk dikirim ke outlet lain (fungsi Gudang Pusat), sekaligus berjualan langsung ke *customer* (fungsi Outlet).

Keputusan krusial: Apakah pencatatan stok dan pelaporan HPP (Cost of Goods Sold) kedua fungsi ini digabung menjadi satu atau dipisah?

## Keputusan Arsitektur
Sistem akan menggunakan pendekatan **Pemisahan Logikal (Logical Separation)**.
Meskipun secara fisik berada di satu ruangan/gedung, di dalam sistem "Gudang Pusat" dan "Outlet Kitchen" adalah dua entitas yang berbeda. 

## Aturan Operasional (Rules of Engagement)

1. **Kedudukan Entitas**
   - **Gudang Pusat**: Menerima barang langsung dari *supplier* / vendor.
   - **Outlet Kitchen**: Dianggap persis sama seperti 18 outlet cabang lainnya.

2. **Alur Permintaan Bahan (Inventory Flow)**
   - Jika Outlet Kitchen kehabisan bahan baku untuk jualan, staf mereka harus membuat "Permintaan Bahan" di sistem, ditujukan ke Gudang Pusat.
   - Pergerakan barang ini memotong stok Gudang Pusat dan menambah stok Outlet Kitchen.

3. **Otorisasi Pengeluaran Barang (Surat Jalan)**
   - Staf biasa/kru *tidak berhak* menyetujui permintaannya sendiri.
   - Surat Jalan (pelepasan stok dari Gudang Pusat ke Outlet Kitchen) HANYA BISA disetujui (di-*approve*) oleh **Supervisor / Kepala Gudang**. Ini menjaga integritas stok dan *segregation of duties*.

4. **Kewajiban Konfirmasi Penerimaan (Goods Receipt)**
   - Walaupun barang hanya digeser antar meja di lokasi yang sama, staf Outlet Kitchen **tetap wajib** menekan tombol "Terima Barang" di aplikasi mereka.
   - Hal ini menjaga agar kode dan alur sistem tetap identik dengan outlet lain (tidak perlu pengecualian kompleks di *source code*) dan memastikan akuntabilitas (pengakuan bahwa barang sah diterima oleh Outlet Kitchen).

5. **Penanganan Sisa / Retur (Waste)**
   - *(TBD / Ditunda)* - Mekanisme pencatatan pembuangan bahan rusak (apakah dicatat sebagai Waste Outlet atau di-Retur ke Gudang) akan dibahas dan disepakati di iterasi selanjutnya.

## Kesimpulan
Dengan pemisahan entitas ini, metrik performa (seperti *Revenue*, HPP, *Waste*) dari Outlet Kitchen dapat dibandingkan secara *apple-to-apple* dengan outlet lainnya, dan stok di Gudang Pusat tetap rapi serta terbebas dari kebocoran akibat operasional eceran/harian.
