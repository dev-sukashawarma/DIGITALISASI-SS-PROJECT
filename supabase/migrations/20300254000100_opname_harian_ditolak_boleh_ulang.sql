-- =============================================================================
-- Opname harian yang DITOLAK tidak lagi mengunci slot hari itu
-- =============================================================================
-- `uniq_opname_harian_per_day` (outlet_id, tanggal) WHERE tipe='harian' juga
-- menghitung baris berstatus 'rejected'. `reject_opname` hanya mengubah status,
-- jadi setelah penolakan crew tidak bisa membuat opname harian baru di hari yang
-- sama: insert-nya 23505, padahal web (`actions/opname.ts`, `.not('status','eq',
-- 'rejected')`) dan native (`OpnameRepository.buatAtauPakaiDraft`, `neq.rejected`)
-- sama-sama dirancang dengan anggapan opname yang ditolak sudah "keluar" dan crew
-- memang diminta menghitung ulang.
--
-- Index diganti dengan predikat yang sama + `status <> 'rejected'`: tetap paling
-- banyak SATU opname harian aktif per outlet per hari, riwayat penolakan tetap
-- tersimpan utuh. Predikat baru lebih longgar dari yang lama, jadi data yang ada
-- dijamin lolos. Tidak ada `ON CONFLICT` yang memakai index ini sebagai arbiter
-- (dicek di fungsi DB, web, dan native).
--
-- Index baru dibuat lebih dulu lalu yang lama dibuang, sehingga tidak ada jeda
-- tanpa penjaga keunikan. Nama lama dipertahankan agar rujukan dokumentasi tetap valid.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_opname_harian_aktif_per_day_baru
  ON public.opname (outlet_id, tanggal)
  WHERE tipe = 'harian' AND status <> 'rejected';

DROP INDEX IF EXISTS public.uniq_opname_harian_per_day;

ALTER INDEX public.uniq_opname_harian_aktif_per_day_baru RENAME TO uniq_opname_harian_per_day;
