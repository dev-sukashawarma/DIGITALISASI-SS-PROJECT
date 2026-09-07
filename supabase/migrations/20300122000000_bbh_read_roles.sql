-- Perluas hak baca harga beli bahan baku ke role yang memang sudah melihatnya.
--
-- Policy lama `bbh_read` hanya mengizinkan role 'admin'. Aturan itu sudah tidak
-- mencerminkan kenyataan: halaman Master Harga Bahan Baku menyajikan harga yang
-- sama ke kitchen/purchasing lewat Server Action ber-service-role
-- (apps/stok/src/app/actions/hargaBahan.ts), jadi RLS-nya ter-bypass dan
-- pembatasan ini praktis cuma berlaku untuk query langsung dari browser.
--
-- Akibat nyatanya: view `inbound_outbound_feed` (security_invoker, sebagaimana
-- mestinya) men-join bahan_baku_harga sebagai user yang login, sehingga kolom
-- "Harga Beli / Satuan" dan "Total Nilai" kosong untuk staff gudang -- padahal
-- merekalah pengguna tunggal tab itu.
--
-- Role di luar daftar ini (crew, kasir, leader, spv, kiosk, mitra, dst) tetap
-- TIDAK bisa membaca harga beli.

DROP POLICY IF EXISTS bbh_read ON public.bahan_baku_harga;

CREATE POLICY bbh_read
    ON public.bahan_baku_harga FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.outlet_staff os
            WHERE os.id = auth.uid()
              AND os.role IN ('admin', 'owner', 'kitchen', 'purchasing', 'admin_finance')
        )
    );
