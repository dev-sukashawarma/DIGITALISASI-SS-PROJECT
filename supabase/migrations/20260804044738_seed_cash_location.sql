-- Insert default bank and cash
INSERT INTO public.cash_location (id, label, kind, bank_name, account_no, holder_name, scope, is_active, opening_balance)
VALUES 
('0c116d5f-f147-4eff-9bc2-ce9d549e2869', 'SUKA PROFIT BERKAH (BCA)', 'bank', 'BCA', '48523399425', 'PT SUKA PROFIT BERKAH', 'pusat', true, 10471000),
('a64f9484-70e9-4bf7-b62d-2643835a1874', 'Kas Setoran (Kas Fisik)', 'cash', NULL, NULL, 'Suka Profit Berkah', 'pusat', true, 10000000)
ON CONFLICT (id) DO NOTHING;

-- Insert petty cash locations for outlets
INSERT INTO public.cash_location (id, label, kind, holder_name, scope, outlet_id, is_active, opening_balance)
SELECT 
  gen_random_uuid(),
  'Kas Kecil ' || name,
  'cash',
  'PIC Outlet',
  'outlet',
  id,
  true,
  0
FROM public.outlets
WHERE name NOT IN ('KANTOR PUSAT', 'GUDANG PUSAT (HQ)', 'GLOBAL OUTLET (SYSTEM)')
AND NOT EXISTS (
  SELECT 1 FROM public.cash_location WHERE outlet_id = public.outlets.id AND scope = 'outlet'
);
