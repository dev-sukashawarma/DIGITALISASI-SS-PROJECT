-- Biaya Ditanggung RAB (Rencana Anggaran Biaya pembukaan outlet baru)
--
-- Keputusan owner 2026-11-05:
--  * Pengeluaran Marcom dengan Sumber Dana "Dana RAB" (mis. promosi opening
--    outlet baru) sudah dibiayai anggaran RAB -> HANYA INFORMASI.
--  * Catatan RAB TIDAK masuk tabel `expenses`, sehingga tidak ada laporan
--    (Buku Kas, Laba Rugi outlet/perusahaan/mitra, ROI/BEP, Ringkasan Bisnis)
--    yang bisa ikut menghitungnya. Tabel ini terpisah total.
--  * Tidak ada plafon RAB; cukup daftar & total per outlet.
--  * Mitra (dan role lain) TIDAK boleh tahu sama sekali -> ditegakkan di RLS.
--    Baca: owner, admin, admin_finance, developer (aktif).
--  * Tulis hanya lewat sinkron dari app Marcom (service_role).

CREATE TABLE IF NOT EXISTS public.biaya_rab_outlet (
  marcom_expense_id bigint PRIMARY KEY,
  outlet_id         uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  outlet_nama       text NOT NULL,
  kategori          text NOT NULL,
  kategori_label    text NOT NULL,
  jumlah            numeric(14,2) NOT NULL CHECK (jumlah > 0),
  keterangan        text NOT NULL,
  tanggal           date NOT NULL,
  receipt_url       text,
  dicatat_at        timestamptz NOT NULL DEFAULT now(),
  diperbarui_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.biaya_rab_outlet IS
  'Pengeluaran Marcom yang ditanggung RAB pembukaan outlet. HANYA INFORMASI: jangan pernah dijumlahkan ke OPEX/laba. Mitra tidak boleh membaca.';

CREATE INDEX IF NOT EXISTS idx_biaya_rab_outlet_tanggal ON public.biaya_rab_outlet (tanggal);
CREATE INDEX IF NOT EXISTS idx_biaya_rab_outlet_outlet ON public.biaya_rab_outlet (outlet_id);

ALTER TABLE public.biaya_rab_outlet ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.biaya_rab_outlet FROM anon, authenticated;
GRANT SELECT ON public.biaya_rab_outlet TO authenticated;
GRANT ALL ON public.biaya_rab_outlet TO service_role;

DROP POLICY IF EXISTS biaya_rab_outlet_baca ON public.biaya_rab_outlet;
CREATE POLICY biaya_rab_outlet_baca ON public.biaya_rab_outlet
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.outlet_staff s
      WHERE s.id = auth.uid()
        AND s.status = 'active'
        AND s.role IN ('owner', 'admin', 'admin_finance', 'developer')
    )
  );
