-- Create the system_guides table
CREATE TABLE IF NOT EXISTS public.system_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content_md TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_guides ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (or public) to read guides
CREATE POLICY "Allow read access for all" ON public.system_guides FOR SELECT USING (true);

-- Allow ADMIN or OWNER to insert/update. 
CREATE POLICY "Allow insert for authenticated users" ON public.system_guides 
    FOR INSERT TO authenticated 
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow update for authenticated users" ON public.system_guides 
    FOR UPDATE TO authenticated 
    USING (true);

-- Insert dummy data based on draft
INSERT INTO public.system_guides (system_code, title, content_md) VALUES
('absensi', 'Panduan Sistem Absensi', '1. **Login Karyawan:** Buka halaman login absensi, masukkan PIN rahasia Anda.
2. **Kiosk Face Recognition:** Berdirilah di depan kamera perangkat di *outlet*. Pastikan wajah tidak tertutup masker. Sistem akan memverifikasi wajah dan mencatat kehadiran Anda secara otomatis.
3. **Pengajuan Cuti:** Masuk ke Dashboard Absensi, pilih menu "Cuti". Isi form tanggal mulai, tanggal selesai, dan alasan cuti. Klik "Ajukan".
4. **Pengajuan Kasbon:** Pilih menu "Kasbon". Masukkan nominal dan alasan peminjaman. HR akan memproses pengajuan ini.
5. **Rekap Kehadiran:** Anda bisa melihat riwayat kehadiran dan jam kerja Anda di menu "Rekap".'),
('pos', 'Panduan Sistem POS (Kasir)', '1. **Buka Shift/Kasir:** Saat *login*, masukkan saldo awal kas (Petty Cash).
2. **Melakukan Transaksi:** Pilih menu dari daftar produk. Sesuaikan kuantitas dan varian (jika ada). Pilih metode pembayaran (Tunai/QRIS), masukkan uang yang diterima, lalu selesaikan pembayaran.
3. **Void Transaksi:** Jika terjadi kesalahan input, masuk ke riwayat pesanan, pilih pesanan yang salah, dan klik "Void". Membutuhkan persetujuan/PIN SPV atau Kepala Outlet.
4. **Tutup Shift/Kasir:** Di akhir shift, lakukan *Blind Close*. Hitung uang fisik di laci dan masukkan nominalnya ke sistem. Sistem akan mencatat selisih (*shrinkage*).'),
('stok', 'Panduan Sistem Stok', '1. **Melihat Stok:** Buka halaman Stok, Anda dapat melihat saldo akhir (Stok Balance) dari setiap bahan baku.
2. **Stock Opname:** Lakukan perhitungan fisik mingguan/bulanan. Pilih menu Opname, masukkan jumlah fisik aktual. Sistem akan menghitung selisih dan menyesuaikan *ledger*.
3. **Permintaan Bahan (PO):** Jika stok menipis, ajukan permintaan bahan ke Pusat/Dapur. Pilih barang dan kuantitas, lalu kirim permintaan.'),
('distribusi', 'Panduan Sistem Distribusi', '1. **Pembuatan Surat Jalan (Pusat):** Saat barang siap dikirim, Admin Gudang membuat Surat Jalan, memilih *outlet* tujuan, dan memasukkan rincian barang.
2. **Pengiriman:** Sopir/Kurir membawa barang berdasarkan Surat Jalan.
3. **Penerimaan (Outlet):** Kepala *outlet* menerima barang, melakukan pengecekan fisik, dan menekan tombol "Terima Barang". Stok *outlet* akan otomatis bertambah (*Auto Ledger*).')
ON CONFLICT (system_code) DO NOTHING;
