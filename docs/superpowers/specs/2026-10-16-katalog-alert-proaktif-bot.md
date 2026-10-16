# Katalog Alert Proaktif Bot per App

**Tanggal:** 2026-10-16
**Status:** Katalog event kandidat; sebagian event prioritas tinggi sudah disiapkan dalam migrasi lokal dan belum aktif sampai migrasi diterapkan.
**Tujuan:** Mendefinisikan kejadian operasional yang layak memicu bot memberi tahu pengguna, berdasarkan domain app yang tersedia.

## Prinsip

- Alert tindakan dikirim kepada PIC menurut role dan outlet. Owner menerima ringkasan atau eskalasi untuk kejadian berdampak besar.
- Setiap alert memiliki prioritas: **Kritis** (perlu respons segera), **Perlu tindakan** (ada tindak lanjut atau tenggat), atau **Informasi** (perubahan/ringkasan yang berguna).
- Alert berulang untuk objek yang sama digabung; pengingat dan eskalasi dikirim jika masalah belum ditangani.
- Isi alert mengikuti izin data penerima dan memuat konteks minimum untuk mengambil tindakan.
- Ambang, jadwal, kanal, dan aturan eskalasi ditentukan saat event dipilih untuk implementasi.

## Kategori Informasi per App

Kategori adalah kelompok informasi yang dipantau; event di bawahnya menentukan kapan bot perlu mengirim alert.

| App | Kategori informasi |
|---|---|
| **Absensi** | Kehadiran, keterlambatan, alpa/belum hadir, jadwal shift, progres checklist absensi |
| **HR** | Cuti dan izin, kasbon, roster/kekosongan staf, onboarding, disiplin dan tindak lanjut kinerja |
| **POS Kasir** | Transaksi, pembayaran, pembatalan/refund, status shift, selisih kas, kendala perangkat atau sinkronisasi |
| **Admin Dashboard** | Penjualan lintas outlet/kanal, pesanan, performa outlet, kelengkapan data, anomali transaksi |
| **Stok** | Stok kritis, permintaan barang, progres opname, selisih opname, waste/reject |
| **Distribusi** | Permintaan outlet, persiapan dan pengiriman, keterlambatan, konfirmasi penerimaan, selisih barang |
| **Finance** | Utang/jatuh tempo PO, persetujuan pengeluaran, setoran, kas kecil, selisih kasir, settlement |
| **Marcom** | Agenda KOL, tenggat konten, jadwal posting, pembayaran, budget iklan, promo, performa konten |
| **Manager** | Checklist dan laporan operasional, waste yang perlu ditinjau, kondisi tim lapangan, perubahan resep/HPP/harga |
| **Inventori** | Status dan kelengkapan data inventaris, jadwal pemeriksaan, perubahan aset, selisih atau barang yang perlu ditindaklanjuti |
| **Owner Dashboard & Sales Board** | Target dan pencapaian, perubahan penjualan yang tidak biasa, laba/pengeluaran, kelengkapan data outlet |
| **Monitoring Sistem** | Ketersediaan app, error/deploy, integrasi, webhook, sinkronisasi, kesegaran data |

Kategori yang sama dapat muncul di lebih dari satu app. Penentuan sumber data utama dan penerima alert dilakukan berdasarkan app yang berwenang atas proses tersebut.

## Implementasi lokal yang disiapkan

| Event | Implementasi |
|---|---|
| Opname outlet belum pernah dilakukan atau sudah lewat 7 hari | Pengingat harian untuk kasus baru, pengingat ulang mingguan, plus ringkasan kepatuhan. |
| PO diterima belum dibayar dan jatuh tempo dalam 3 hari atau sudah lewat | Ringkasan harian untuk kasus baru dan pengingat ulang mingguan kepada Finance. |
| Transaksi Finance masuk antrean persetujuan | Push saat transaksi masuk status `pending_approval`. |
| Laporan waste masuk antrean persetujuan | Push langsung ke approver yang memiliki cakupan outlet. |
| Status monitoring sistem berubah menjadi gangguan atau pulih | Push saat transisi status; tidak mengulang setiap polling. |
| Stok menembus ambang minimum | Alert bot Stokist ke leader outlet yang terhubung saat stok turun melewati ambang efektif. |
| Surat jalan berubah menjadi dikirim | Alert bot Stokist ke leader/kru outlet penerima untuk konfirmasi penerimaan. |
| Penerimaan surat jalan ditandai memiliki selisih | Alert bot Stokist ke kitchen, purchasing, admin, dan owner yang terhubung untuk meninjau verifikasi. |

Alert Stok dan Distribusi dikirim lewat bot Stokist tersendiri hanya kepada staf
yang sudah menautkan Telegram dan masuk dalam cakupan role/outlet event. Bot CEO
Hermes tetap melayani akses lintas app dan laporan owner. Push yang sudah ada
tetap berjalan.

Semua perubahan di atas baru berupa file lokal; belum diterapkan ke database produksi.

## Katalog Event

### Absensi & HR

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | Staf terlambat atau belum hadir setelah batas jam masuk outlet/shift | PIC outlet, HR |
| Perlu tindakan | Alpa terdeteksi berdasarkan jadwal yang berlaku | HR, atasan terkait |
| Perlu tindakan | Pengajuan cuti/izin menunggu persetujuan atau tanggal cuti mendekat | Approver, HR |
| Perlu tindakan | Checklist harian belum selesai saat mendekati batas waktu | PIC outlet, atasan |
| Perlu tindakan | Roster menunjukkan shift tanpa staf yang cukup atau kekosongan jadwal | HR, manager terkait |
| Perlu tindakan | Pengajuan kasbon menunggu keputusan | Approver HR |

### POS & Penjualan

| Prioritas | Event | Penerima utama |
|---|---|---|
| Kritis | Transaksi gagal atau pembayaran bermasalah dan belum pulih | PIC outlet, PIC teknis/pembayaran |
| Perlu tindakan | Shift belum ditutup setelah jam operasional | PIC outlet, manager |
| Perlu tindakan | Selisih kas saat tutup shift melewati ambang yang ditetapkan | PIC outlet, finance, manager |
| Perlu tindakan | Penjualan outlet tertinggal jauh dari target atau pola pembanding | Manager, owner melalui ringkasan |
| Perlu tindakan | Pembatalan atau refund meningkat melewati ambang | Manager, finance |
| Kritis | Outlet tidak mengirim transaksi ketika seharusnya aktif | PIC outlet, PIC teknis |

### Stok & Inventori

| Prioritas | Event | Penerima utama |
|---|---|---|
| Kritis | Stok di bawah ambang kritis atau perkiraan habis sebelum pengiriman berikutnya | PIC gudang, PIC outlet |
| Perlu tindakan | Permintaan stok menunggu persetujuan atau pemenuhan melewati SLA | Approver, PIC gudang |
| Perlu tindakan | Opname wajib belum dimulai atau belum diselesaikan saat jadwal/batas waktunya tiba | PIC outlet, manager stok |
| Perlu tindakan | Selisih hasil opname melewati ambang atau hasil opname menunggu review/persetujuan | PIC outlet, manager stok/approver |
| Perlu tindakan | Waste/reject menunggu review atau melewati ambang | Approver, manager terkait |
| Informasi | Data inventaris belum diperbarui sesuai jadwal pemeriksaan | PIC inventaris outlet, manager |

### Distribusi

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | Surat jalan belum disiapkan atau belum dikirim menjelang jadwal | PIC distribusi |
| Kritis | Pengiriman terlambat dari jadwal yang disepakati | PIC distribusi, outlet penerima |
| Perlu tindakan | Penerimaan kiriman belum dikonfirmasi | PIC outlet penerima |
| Perlu tindakan | Jumlah/barang yang diterima berbeda dari surat jalan | PIC outlet, PIC distribusi |
| Perlu tindakan | Permintaan outlet belum terpenuhi menjelang kebutuhan operasional | PIC gudang/distribusi, outlet |

### Finance

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | PO yang sudah diterima belum dibayar dan mendekati jatuh tempo | PIC finance/pembayaran |
| Kritis | Utang PO melewati jatuh tempo | PIC finance, owner melalui eskalasi |
| Perlu tindakan | Pengeluaran menunggu persetujuan melewati batas waktu | Approver finance |
| Perlu tindakan | Setoran yang diharapkan belum tercatat sesuai proses/periode | PIC outlet, finance; hanya jika sumber data memastikan setoran memang diharapkan |
| Perlu tindakan | Selisih kasir melewati ambang | Finance, manager outlet |
| Perlu tindakan | Kas kecil mendekati batas atau perlu pengisian | PIC petty cash, finance |
| Perlu tindakan | Settlement terlambat atau nilainya tidak cocok dengan data transaksi | Finance, PIC kanal terkait |

### Marcom

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | Jadwal visit/delivery KOL, review draft, atau posting mendekati tenggat | PIC Marcom |
| Perlu tindakan | Konten terlambat tayang dari jadwal | PIC Marcom, creator terkait |
| Perlu tindakan | Pembayaran rate card menunggu atau mendekati tenggat | PIC Marcom, finance |
| Perlu tindakan | Budget iklan mendekati atau melewati batas | PIC Marcom, approver budget |
| Informasi | Promo akan dimulai atau berakhir | PIC Marcom, outlet terdampak |
| Informasi | Performa konten jauh di bawah target yang ditentukan | PIC Marcom |

### Manager & Operasi Outlet

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | Waste menunggu persetujuan | Approver/manager terkait |
| Perlu tindakan | Laporan atau checklist operasional melewati tenggat | PIC outlet, manager |
| Perlu tindakan | Lokasi tim lapangan tidak diperbarui saat pemantauan memang diperlukan | Manager terkait |
| Informasi | Resep/HPP atau harga outlet berubah dan membutuhkan tinjauan | PIC operasional, finance/owner sesuai kewenangan |

### Owner Dashboard & Sales Board

| Prioritas | Event | Penerima utama |
|---|---|---|
| Perlu tindakan | Outlet tertinggal dari target harian melewati ambang | Manager area, owner melalui ringkasan |
| Perlu tindakan | Penjualan turun tajam dibanding periode pembanding yang setara | Manager area, owner |
| Informasi | Perubahan penting pada laba atau pengeluaran | Owner, finance |
| Kritis | Data satu atau beberapa outlet tidak masuk sehingga ringkasan bisnis tidak lengkap | PIC teknis/data, owner melalui ringkasan |

### Monitoring & Sistem

| Prioritas | Event | Penerima utama |
|---|---|---|
| Kritis | App atau integrasi tidak tersedia | PIC teknis |
| Kritis | Deploy gagal atau error mengganggu alur operasional | PIC teknis; owner jika berdampak luas |
| Perlu tindakan | Data berhenti diperbarui melewati batas kesegaran data | PIC teknis/data |
| Perlu tindakan | Webhook atau sinkronisasi gagal berulang | PIC teknis/integrasi |

## Batasan dan Catatan Sumber

- Ini adalah katalog kandidat, bukan daftar event yang sudah aktif atau jaminan bahwa semua app memiliki event stream siap pakai.
- Sebelum aktivasi, setiap event perlu dipasangkan dengan sumber data yang berwenang, kondisi pemicu yang bisa diukur, penerima, dan tautan ke layar tindakan.
- Event seperti “setoran belum tercatat”, “penjualan turun”, “performa di bawah target”, dan “lokasi tidak diperbarui” memerlukan definisi konteks/ambang agar bot tidak menyimpulkan masalah dari data yang kosong atau terlambat.
- Pemberitahuan tidak boleh memuat data sensitif yang tidak diperlukan. Khusus data HR dan pelanggan, gunakan ringkasan yang sesuai izin role.
- Portal dan webapp Bot adalah platform, bukan domain event bisnis. Status gangguan platform masuk ke Monitoring & Sistem.
