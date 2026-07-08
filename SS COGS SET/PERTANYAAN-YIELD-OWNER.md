# Daftar Pertanyaan Deep-Dive untuk Owner (Audit Operasional & Stok)

Dokumen ini merupakan perluasan (deep-dive) dari analisis penyusutan sebelumnya. Untuk membangun sistem inventory dan kasir yang benar-benar akurat di lapangan (bukan sekadar akurat di atas kertas), kita perlu mengaudit kebiasaan operasional dapur. 

Silakan sampaikan pertanyaan-pertanyaan strategis ini kepada *Owner* atau Manajer Operasional:

## 1. Distribusi Internal (*Central Kitchen* ke Outlet) & Penerimaan Barang
*Konteks: Jika data mutasi barang dari awal sudah salah, maka seluruh perhitungan otomatis di aplikasi outlet akan salah (Garbage In, Garbage Out).*
* **1.1 Pengiriman Internal (Pusat ke Outlet):** Saat *Central Kitchen* (Dapur Pusat) mengirimkan bahan baku (daging marinasi, bumbu, saus, dll) ke outlet cabang, apakah sistem POS mencatatnya sebagai Mutasi/Transfer Stok otomatis, atau staf outlet harus menginput manual sebagai barang masuk?
* **1.2 Risiko Perjalanan (Transit & Suhu):** Bagaimana perlakuan barang yang mencair atau rusak di jalan? Contoh: Jika Pusat mengirim 10kg daging beku tapi sampai di outlet esnya lumer dan beratnya tinggal 9,5kg, siapakah yang menanggung susut 500 gram tersebut secara sistem? (Apakah Pusat tercatat keluar 10kg, dan Outlet tercatat masuk 9,5kg?)
* **1.3 Timbang Ulang di Outlet:** Apakah staf outlet **selalu diwajibkan menimbang ulang** barang kiriman dari pusat secara fisik di depan *driver*/kurir sebelum menandatangani Surat Jalan Internal?

## 2. Platform *Online* (GoFood, GrabFood, ShopeeFood) & *Cancelation*
*Konteks: Pesanan online memiliki celah masalah yang berbeda dengan dine-in/takeaway biasa.*
* **2.1 Pesanan Batal (*Cancel*):** Jika makanan sudah terlanjur dibuat/dimasak, lalu *driver* membatalkan pesanan (*cancel* / fiktif), makanan tersebut dikemanakan? Apakah dimakan staf, disumbangkan, atau dibuang? Bagaimana cara kasir mengembalikan/membuang stoknya di sistem?

## 3. Akurasi Porsi (*Portion Control*) & Kalibrasi Alat
*Konteks: Kebocoran stok paling sering terjadi karena staf memberi porsi lebih banyak dari resep standar.*
* **3.1 Alat Ukur:** Apakah staf benar-benar menimbang daging dan kentang per porsi menggunakan timbangan digital untuk **setiap** pesanan, atau mereka menggunakan *feeling*? 
* **3.2 Kalibrasi Timbangan:** Apakah timbangan digital dapur rutin dicek akurasinya (kalibrasi)? *(Timbangan yang rusak/melemah baterainya bisa menunjukkan angka 50 gram padahal aslinya staf menaruh 70 gram daging. Ini pembunuh stok yang paling tak terlihat).*

## 4. Kebijakan Karyawan & *Human Error*
*Konteks: Barang yang keluar tapi tidak menghasilkan uang masuk.*
* **4.1 Barang Gagal / Gosong:** Jika staf salah buat, produk gagal itu dikemanakan? Apakah dibuang, dimakan staf, dan apakah ada buku catatan mutasi khusus?

## 5. Manajemen Penyimpanan & Penanganan Limbah (*Waste*)
*Konteks: Kehilangan barang karena basi, rusak murni, atau proses.*
* **5.1 Otoritas Pembuangan:** Jika ada sayur busuk/basi, siapa yang berhak memutuskannya dibuang? Apakah harus difoto sebagai bukti mutasi barang rusak?
* **5.2 *Trimming* Urat/Lemak Daging:** Saat membersihkan daging mentah, apakah sisa urat/lemak/darah ditimbang sebelum dibuang ke tong sampah?
* **5.3 Sisa Saus (Transfer Loss):** Kalau saus/mayones di *pouch* sudah susah dipencet, apakah plastiknya digunting lalu dikerok, atau langsung dibuang?

## 6. Keamanan & Prosedur *Stock Opname* (Cek Fisik)
*Konteks: Cara owner mengecek silang kejujuran laporan staf.*
* **6.1 *Blind Stock* vs *Open Stock*:** Saat staf menghitung fisik barang, apakah mereka sudah melihat angka "Seharusnya Ada X" di aplikasi (*Open Stock*)? *(Rekomendasi: Lakukan Blind Stock untuk mencegah manipulasi data).*
* **6.2 Batas Toleransi Kehilangan (*Threshold*):** Jika pada akhir bulan stok sapi minus 500 gram, apakah dianggap "wajar"? Di angka persentase berapa owner menetapkan batas toleransi sebelum diberlakukan potong gaji?

---
**Rekomendasi Tindakan:**
Bawa daftar ini saat *meeting* operasional dengan *Owner* atau Kepala Dapur. Jawaban dari dokumen ini akan menentukan *setup* formula *Bill of Materials* (BOM), hak akses (*privilege*) staf di kasir POS, dan SOP Logistik internal ke depannya.
