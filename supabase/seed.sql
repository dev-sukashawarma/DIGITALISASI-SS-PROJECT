-- Insert 19 sample outlets with Jakarta-area placeholder coordinates
-- TODO: Replace UUIDs and coordinates with actual Ecosystem data after Supabase project created

INSERT INTO outlets (id, slug, name, lat, lng, address, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'outlet-jkt-01', 'Suka Shawarma Senayan', -6.2149, 106.8066, 'Senayan, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440002', 'outlet-jkt-02', 'Suka Shawarma Blok M', -6.2831, 106.7867, 'Blok M, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440003', 'outlet-jkt-03', 'Suka Shawarma Kuningan', -6.2196, 106.8223, 'Kuningan, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440004', 'outlet-jkt-04', 'Suka Shawarma Kemang', -6.2732, 106.7983, 'Kemang, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440005', 'outlet-jkt-05', 'Suka Shawarma Tebet', -6.2480, 106.8429, 'Tebet, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440006', 'outlet-jkt-06', 'Suka Shawarma Ragunan', -6.2957, 106.7908, 'Ragunan, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440007', 'outlet-jkt-07', 'Suka Shawarma Cipete', -6.2695, 106.7726, 'Cipete, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440008', 'outlet-jkt-08', 'Suka Shawarma Pondok Indah', -6.3049, 106.7604, 'Pondok Indah, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440009', 'outlet-jkt-09', 'Suka Shawarma Fatmawati', -6.3153, 106.7558, 'Fatmawati, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440010', 'outlet-jkt-10', 'Suka Shawarma Puri', -6.2235, 106.6895, 'Puri, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440011', 'outlet-bdg-01', 'Suka Shawarma Bandung', -6.9147, 107.6098, 'Bandung, Jawa Barat', true),
('550e8400-e29b-41d4-a716-446655440012', 'outlet-tng-01', 'Suka Shawarma Tangerang', -6.1749, 106.6294, 'Tangerang, Banten', true),
('550e8400-e29b-41d4-a716-446655440013', 'outlet-tng-02', 'Suka Shawarma Balaraja', -6.2071, 106.4504, 'Balaraja, Tangerang', true),
('550e8400-e29b-41d4-a716-446655440014', 'outlet-tng-03', 'Suka Shawarma Cilegon', -6.0280, 106.2871, 'Cilegon, Banten', true),
('550e8400-e29b-41d4-a716-446655440015', 'outlet-bka-01', 'Suka Shawarma Bekasi', -6.2349, 107.0053, 'Bekasi, Jawa Barat', true),
('550e8400-e29b-41d4-a716-446655440016', 'outlet-bka-02', 'Suka Shawarma Karawang', -6.3050, 107.2850, 'Karawang, Jawa Barat', true),
('550e8400-e29b-41d4-a716-446655440017', 'outlet-bntr-01', 'Suka Shawarma Bintaro', -6.3229, 106.7372, 'Bintaro, Tangerang', true),
('550e8400-e29b-41d4-a716-446655440018', 'outlet-jkt-11', 'Suka Shawarma Scbd', -6.2277, 106.8160, 'SCBD, Jakarta', true),
('550e8400-e29b-41d4-a716-446655440019', 'outlet-jkt-12', 'Suka Shawarma Semanggi', -6.2361, 106.8110, 'Semanggi, Jakarta', true);

-- Insert sample outlet_staff (1 crew per outlet for testing)
INSERT INTO outlet_staff (outlet_id, name, role, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Budi Kusuma', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440002', 'Siti Rahman', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440003', 'Ahmad Wijaya', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440004', 'Ratna Dewi', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440005', 'Bambang Irawan', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440006', 'Eka Putri', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440007', 'Hendra Gunawan', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440008', 'Rina Saptiana', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440009', 'Joko Santoso', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440010', 'Lina Hermawan', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440011', 'Toni Hermanto', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440012', 'Yudi Prasetyo', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440013', 'Maya Kusumah', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440014', 'Rolan Wijaya', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440015', 'Dina Marlina', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440016', 'Sugeng Santoso', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440017', 'Wati Suryani', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440018', 'Fadli Ramadhan', 'crew', 'active'),
('550e8400-e29b-41d4-a716-446655440019', 'Silvia Pratiwi', 'crew', 'active');
