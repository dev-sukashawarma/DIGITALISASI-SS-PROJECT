-- Seed data mockup checklist untuk semua outlet yang sudah ada
-- Dibuat dalam bentuk fungsi agar bisa dijalankan per outlet

DO $$
DECLARE
  outlet_row RECORD;
  cat_keamanan UUID;
  cat_alat UUID;
  cat_bahan UUID;
  cat_kebersihan UUID;
BEGIN
  FOR outlet_row IN SELECT id FROM outlets LOOP

    -- Kategori 1: Keamanan & Akses
    INSERT INTO checklist_categories (id, outlet_id, name)
    VALUES (gen_random_uuid(), outlet_row.id, 'Keamanan & Akses')
    ON CONFLICT DO NOTHING
    RETURNING id INTO cat_keamanan;

    IF cat_keamanan IS NOT NULL THEN
      INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
        (cat_keamanan, 'Periksa kondisi kunci pintu utama', true),
        (cat_keamanan, 'Nyalakan sistem CCTV dan pastikan rekaman berjalan', true),
        (cat_keamanan, 'Periksa kondisi kasir dan laci uang', true),
        (cat_keamanan, 'Pastikan pintu darurat tidak terhalang', false);
    END IF;

    -- Kategori 2: Alat Masak & Peralatan
    INSERT INTO checklist_categories (id, outlet_id, name)
    VALUES (gen_random_uuid(), outlet_row.id, 'Alat Masak & Peralatan')
    ON CONFLICT DO NOTHING
    RETURNING id INTO cat_alat;

    IF cat_alat IS NOT NULL THEN
      INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
        (cat_alat, 'Cek isi tabung gas LPG dan kondisi selang', true),
        (cat_alat, 'Nyalakan kompor dan pastikan api stabil', true),
        (cat_alat, 'Periksa kondisi dan kebersihan panggangan', true),
        (cat_alat, 'Cek mesin kasir / POS sudah menyala', true),
        (cat_alat, 'Cek kondisi pisau dan peralatan potong', false),
        (cat_alat, 'Pastikan termos / penghangat makanan berfungsi', false);
    END IF;

    -- Kategori 3: Bahan Baku
    INSERT INTO checklist_categories (id, outlet_id, name)
    VALUES (gen_random_uuid(), outlet_row.id, 'Bahan Baku')
    ON CONFLICT DO NOTHING
    RETURNING id INTO cat_bahan;

    IF cat_bahan IS NOT NULL THEN
      INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
        (cat_bahan, 'Cek stok daging / shawarma (minimal 5kg)', true),
        (cat_bahan, 'Cek ketersediaan roti pita / tortilla', true),
        (cat_bahan, 'Cek stok saus dan bumbu (garlic, sambal, dll)', true),
        (cat_bahan, 'Cek stok sayuran (tomat, selada, timun)', true),
        (cat_bahan, 'Periksa tanggal kadaluarsa bahan yang sudah dibuka', true),
        (cat_bahan, 'Laporkan bahan yang hampir habis ke SPV', false);
    END IF;

    -- Kategori 4: Kebersihan & Sanitasi
    INSERT INTO checklist_categories (id, outlet_id, name)
    VALUES (gen_random_uuid(), outlet_row.id, 'Kebersihan & Sanitasi')
    ON CONFLICT DO NOTHING
    RETURNING id INTO cat_kebersihan;

    IF cat_kebersihan IS NOT NULL THEN
      INSERT INTO checklist_items (category_id, task_name, is_required) VALUES
        (cat_kebersihan, 'Bersihkan dan lap meja area pelanggan', true),
        (cat_kebersihan, 'Bersihkan area dapur dan meja persiapan', true),
        (cat_kebersihan, 'Buang sampah dari semua tempat sampah', true),
        (cat_kebersihan, 'Cek kebersihan toilet / kamar mandi (jika ada)', false),
        (cat_kebersihan, 'Pel lantai area kasir dan dapur', true);
    END IF;

  END LOOP;
END $$;
