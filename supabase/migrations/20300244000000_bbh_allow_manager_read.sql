-- 20300244000000_bbh_allow_manager_read.sql
--
-- Mengizinkan role manajemen (regional_manager dan area_manager) membaca harga beli bahan baku
-- pada tabel bahan_baku_harga agar estimasi nominal kerugian waste di dashboard manager
-- tampil akurat pada query langsung PostgREST client autentikasi.
--
-- Sebelumnya policy bbh_read hanya mencakup ('admin', 'owner', 'kitchen', 'purchasing', 'admin_finance'),
-- sehingga request dari aplikasi mobile dengan akun regional_manager / area_manager terblokir RLS
-- dan menghasilkan estimasi kerugian Rp 0.

DROP POLICY IF EXISTS bbh_read ON public.bahan_baku_harga;

CREATE POLICY bbh_read
    ON public.bahan_baku_harga FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.outlet_staff os
            WHERE os.id = auth.uid()
              AND os.role IN ('admin', 'owner', 'kitchen', 'purchasing', 'admin_finance', 'regional_manager', 'area_manager', 'developer')
              AND os.is_active = true
        )
    );
