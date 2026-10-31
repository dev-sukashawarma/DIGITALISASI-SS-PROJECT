-- Seed nilai investasi kemitraan resmi untuk cabang Mitra baru Oktober 2026:
-- 1. MITRA CILEUDUG (3d8cc715-3f2d-43c6-a7b0-1841d60de8f7): Rp 156.000.000
-- 2. MITRA PONDOK AREN (48b980da-5a42-4a9b-a952-86ab5db6666a): Rp 153.000.000
-- Skema adaptif Sept 2026 (Belum BEP: 100% bagi hasil mitra, 3% management fee omzet kotor).

DO $$
BEGIN
  -- 1. MITRA CILEUDUG
  IF EXISTS (SELECT 1 FROM public.outlets WHERE id = '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7') THEN
    IF EXISTS (SELECT 1 FROM public.mitra_investments WHERE outlet_id = '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7') THEN
      UPDATE public.mitra_investments
      SET nilai_investasi = 156000000,
          tanggal_mulai = COALESCE(tanggal_mulai, '2026-10-01'),
          is_profit_sharing_active = true,
          persentase_bagi_hasil = 100,
          management_fee = 3,
          updated_at = now()
      WHERE outlet_id = '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7';
    ELSE
      INSERT INTO public.mitra_investments (
        outlet_id,
        nilai_investasi,
        tanggal_mulai,
        catatan,
        omzet_historis,
        transfer_historis,
        is_profit_sharing_active,
        persentase_bagi_hasil,
        management_fee
      ) VALUES (
        '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7',
        156000000,
        '2026-10-01',
        'Outlet Kemitraan Ciledug - Oktober 2026 (Management fee 3% omzet kotor)',
        0,
        0,
        true,
        100,
        3
      );
    END IF;
  END IF;

  -- 2. MITRA PONDOK AREN
  IF EXISTS (SELECT 1 FROM public.outlets WHERE id = '48b980da-5a42-4a9b-a952-86ab5db6666a') THEN
    IF EXISTS (SELECT 1 FROM public.mitra_investments WHERE outlet_id = '48b980da-5a42-4a9b-a952-86ab5db6666a') THEN
      UPDATE public.mitra_investments
      SET nilai_investasi = 153000000,
          tanggal_mulai = COALESCE(tanggal_mulai, '2026-10-01'),
          is_profit_sharing_active = true,
          persentase_bagi_hasil = 100,
          management_fee = 3,
          updated_at = now()
      WHERE outlet_id = '48b980da-5a42-4a9b-a952-86ab5db6666a';
    ELSE
      INSERT INTO public.mitra_investments (
        outlet_id,
        nilai_investasi,
        tanggal_mulai,
        catatan,
        omzet_historis,
        transfer_historis,
        is_profit_sharing_active,
        persentase_bagi_hasil,
        management_fee
      ) VALUES (
        '48b980da-5a42-4a9b-a952-86ab5db6666a',
        153000000,
        '2026-10-01',
        'Outlet Kemitraan Pondok Aren - Oktober 2026 (Management fee 3% omzet kotor)',
        0,
        0,
        true,
        100,
        3
      );
    END IF;
  END IF;

  -- Sinkronkan persentase_bagi_hasil ke mitra_profiles terkait (Belum BEP = 100%)
  UPDATE public.mitra_profiles
  SET profit_sharing_pct = 100,
      updated_at = now()
  WHERE outlet_ids && ARRAY[
    '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7'::uuid,
    '48b980da-5a42-4a9b-a952-86ab5db6666a'::uuid
  ];
END $$;
