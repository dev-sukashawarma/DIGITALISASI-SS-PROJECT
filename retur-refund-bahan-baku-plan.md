# Retur & Refund Bahan Baku (Item Core)

## Goal
Membangun modul dan alur penanganan retur/refund bahan baku core (Ayam, Sapi, Kulit) dari outlet dengan gerbang persetujuan AM/RM, pelacakan logistik internal & 3PL (Lalamove/GoSend), verifikasi Kitchen, penggantian fisik 100%, serta klaim lanjutan ke vendor.

## Tasks
- [ ] Task 1: Buat migrasi database untuk flag `is_refundable` di `bahan_baku`, tabel `retur_stok` (dengan kolom `approved_by_manager`, `jenis_logistik`, `nomor_resi_order`, `driver_plat_kendaraan`), `retur_stok_item`, dan constraint tipe ledger baru → Verify: Cek skema lewat query `\d retur_stok` dan verifikasi RLS policy.
- [ ] Task 2: Buat RPC database untuk pengajuan retur aman bertransaksi (kurangi ledger outlet secara atomic & catat retur status `diajukan`) → Verify: Panggil RPC test dengan user outlet, periksa saldo `ledger_stok` berkurang sesuai qty.
- [ ] Task 3: Buat RPC dan endpoint approval untuk role `area_manager` / `regional_manager` (setujui / tolak klaim outlet) → Verify: Panggil RPC dengan role AM, periksa status beralih ke `disetujui_manager` (atau `ditolak` dengan konversi waste).
- [ ] Task 4: Buat RPC verifikasi timbang fisik Kitchen & penerbitan Surat Jalan Pengganti otomatis (hanya untuk tiket yang sudah disetujui AM/RM) → Verify: Eksekusi RPC approval kitchen, pastikan surat jalan pengganti terbit dengan flag `is_retur_replacement = true`.
- [ ] Task 5: Bangun komponen UI halaman `/stok/refund` (Tab Klaim Aktif, Tab Riwayat, Tab Approval AM/RM, dan Tab Antrean Kitchen) → Verify: Halaman ter-render di dev server, tab switcher menyesuaikan role pengguna.
- [ ] Task 6: Bangun formulir pengajuan retur `/stok/refund/new` dengan input composite unit & upload bukti foto timbangan → Verify: Form memvalidasi hanya bahan `is_refundable`, upload gambar tersimpan ke bucket storage.
- [ ] Task 7: Bangun modal serah terima kurir (mendukung Internal & 3PL: Lalamove, GoSend, GrabExpress, Deliveree dengan input Order ID/Resi, plat nomor, & foto serah terima) → Verify: Form memvalidasi input 3PL dan status berpindah ke `dalam_pengiriman`.
- [ ] Task 8: Integrasikan verifikasi penerimaan SJ Pengganti di sisi outlet (1:1 matching balance) → Verify: Saat SJ pengganti diterima tiket otomatis `selesai` dan saldo outlet kembali utuh.
- [ ] Task 9: Integrasikan menu Tab Refund ke `BottomNav` (drawer 'Lainnya' dengan badge pending untuk AM/RM & Kitchen) dan Action Button Dashboard → Verify: Ikon Retur muncul dengan badge aktif, navigasi routing berjalan mulus.
- [ ] Task 10: Buat modul pencatatan Surat Retur Vendor (SRV) untuk Central Kitchen meneruskan klaim ke supplier → Verify: Cetak/preview dokumen SRV dengan data PO dan vendor terkait.

## Done When
- [ ] Kru outlet bisa mengajukan retur bahan core (Ayam, Sapi, Kulit) dengan bukti timbangan, dan stok outlet otomatis terpotong di ledger.
- [ ] AM atau RM dapat mereview foto bukti dan memberikan approval sebelum kurir mengambil fisik barang.
- [ ] Kru dapat mencatat serah terima ke kurir internal maupun pihak ketiga (Lalamove/GoSend) dengan nomor resi dan foto serah terima.
- [ ] Staf Central Kitchen menerima fisik barang, mencocokkan resi, menimbang ulang, dan menerbitkan Surat Jalan Pengganti 1:1.
- [ ] Saat outlet menerima SJ Pengganti, tiket retur otomatis selesai dan saldo outlet kembali utuh.
- [ ] Central Kitchen dapat menerbitkan dokumen Surat Retur Vendor (SRV) untuk klaim ke supplier.

## Notes
- Semua pergerakan stok wajib melalui `ledger_stok`, dilarang mengupdate saldo `stok_balance` secara langsung (SOP 2026-07-08).
- Kurir 3PL (Lalamove, dll) wajib dicatat Order ID/Resi dan foto serah terima agar jika paket hilang di jalan ada dasar klaim ke pihak ekspedisi.
