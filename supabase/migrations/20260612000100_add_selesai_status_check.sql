-- Alter the check constraint on surat_jalan status to include 'selesai' and 'dikirim_lengkap'
ALTER TABLE surat_jalan DROP CONSTRAINT IF EXISTS surat_jalan_status_check;

ALTER TABLE surat_jalan ADD CONSTRAINT surat_jalan_status_check
  CHECK (status IN ('draft', 'dikirim', 'dikirim_lengkap', 'diterima_sebagian', 'diterima_lengkap', 'selesai'));
