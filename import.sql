DO $$ 
DECLARE 
  v_outlet_name TEXT := 'EMPANG';
  v_outlet_id UUID;
BEGIN
  SELECT id INTO v_outlet_id FROM public.outlets WHERE name ILIKE '%' || v_outlet_name || '%' LIMIT 1;
  IF v_outlet_id IS NULL THEN
    RAISE EXCEPTION 'Outlet dengan nama "%" tidak ditemukan!', v_outlet_name;
  END IF;

  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 8333, 'Kas Masuk', '2026-07-02', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 8333, 'Bensin + Etoll', '2026-07-02', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 46000, 'Gas 2 tabung', '2026-07-01', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie', '2026-07-01', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 57000, 'Lalamove', '2026-07-01', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 75000, 'Jasa pasang banner', '2026-07-01', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Transport bahan baku', '2026-07-01', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas Masuk', '2026-07-01', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 40000, 'Tissue', '2026-07-02', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun pel', '2026-07-02', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun cuci', '2026-07-02', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 34000, 'Kopi 2 renceng', '2026-07-02', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 115000, 'Gas 5 tabung', '2026-07-03', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 100000, 'Lembur crew', '2026-07-03', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 17429, 'Kas Masuk', '2026-07-03', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 17429, 'Bensin + Etoll', '2026-07-03', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'utilities', 105000, 'Token Listrik', '2026-07-04', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 100000, 'Freelance Hasan', '2026-07-04', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 16000, 'Plastik', '2026-07-04', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas Masuk', '2026-07-04', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 35000, 'Ikat plastik', '2026-07-05', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Transport bahan baku plastik', '2026-07-05', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 100000, 'Freelance hasan', '2026-07-05', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 8944, 'Kas Masuk', '2026-07-06', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 8944, 'Bensin + Etoll', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 70000, 'Lembur crew', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 30000, 'Lalamove', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 115000, 'Gas 5 tabung', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 13000, 'Air minum', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 50000, 'Lembur training', '2026-07-06', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 40000, 'Plastik', '2026-07-07', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun cuci piring', '2026-07-07', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 50000, 'Tissue', '2026-07-07', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 5000, 'Kawat cuci', '2026-07-07', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 21000, 'Kas Masuk', '2026-07-10', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 21000, 'Bensin + Etoll', '2026-07-10', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 65000, 'Lembur crew + Transport ', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 12000, 'Bensin dapur', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Transport bahan baku', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 47000, 'Lalamove', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas Masuk', '2026-07-08', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 100000, 'Lembur Omset', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 100000, 'Lembur Omset', '2026-07-08', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 50000, 'Lalamove', '2026-07-11', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie', '2026-07-11', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun pel lantai', '2026-07-11', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas Masuk', '2026-07-11', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun cuci', '2026-07-12', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 55000, 'Tissue', '2026-07-12', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 25000, 'Es batu', '2026-07-12', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 23000, 'Gas 1 tabung', '2026-07-12', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 161000, 'Gas 7 tabung', '2026-07-13', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie', '2026-07-13', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas Masuk', '2026-07-13', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie', '2026-07-14', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 70000, 'Plastik', '2026-07-14', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Bensin', '2026-07-14', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 13000, 'Driver salah order', '2026-07-14', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung', '2026-07-15', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 19000, 'Air galon', '2026-07-15', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'utilities', 105000, 'Token Listrik', '2026-07-15', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 19737, 'Kas Masuk', '2026-07-16', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 19737, 'Print ', '2026-07-16', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Uang makan driver', '2026-07-17', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Transport bahan baku', '2026-07-17', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 50000, 'Meeting lembur', '2026-07-17', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 55000, 'Tissue', '2026-07-17', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun pel lantai', '2026-07-17', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung', '2026-07-18', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 5000, 'Tuker receh admin', '2026-07-18', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 150000, 'Lemburan meeting 3 orang', '2026-07-21', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung', '2026-07-21', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 500000, 'Kas masuk', '2026-07-22', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun cuci piring', '2026-07-22', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Sabun pembersih lantai', '2026-07-22', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 55000, 'Tissu 5 pcs', '2026-07-22', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 34000, 'Kopi 2 renceng', '2026-07-22', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 27000, 'Lalamove', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 11000, 'Solatip 3', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 8000, 'Plastik 2', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 200000, 'Iuran keamanan dan kebersihan', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 14500, 'Indomie 5 ', '2026-07-24', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Trasnport bahan baku', '2026-07-25', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 30000, 'Plastik polly bag ', '2026-07-25', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 13000, 'Air minum', '2026-07-25', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas masuk', '2026-07-26', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Trasnport bahan baku', '2026-07-26', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 20000, 'Lalamove kunci', '2026-07-26', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 40000, 'Plastik 5', '2026-07-26', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 17500, 'Indomie 5', '2026-07-26', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'cash_in', 500000, 'Kas masuk', '2026-07-27', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'utilities', 438500, 'Indihome', '2026-07-27', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'utilities', 105000, 'Token listrik', '2026-07-27', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'overtime', 150000, 'Lemburan meeting 3 orang', '2026-07-27', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 14500, 'Indomie 5 ', '2026-07-27', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 69000, 'Gas 3 tabung', '2026-07-28', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 50000, 'Tissu 5', '2026-07-28', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 40000, 'Kantong Plastik 8', '2026-07-28', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'bb', 92000, 'Gas 4 tabung ', '2026-07-30', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Transport Bahan Baku ', '2026-07-30', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Pembersih lantai', '2026-07-30', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'admin', 600000, 'Kas Masuk ', '2026-07-31', 'petty_cash', 'income');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 16500, 'Mie Goreng 5', '2026-07-31', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 10000, 'Kuota 6 Gb 1 hari', '2026-07-31', 'petty_cash', 'expense');
  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)
  VALUES (v_outlet_id, 'outlet', 15000, 'Transport HB Bahsin', '2026-07-31', 'petty_cash', 'expense');
END $$;

