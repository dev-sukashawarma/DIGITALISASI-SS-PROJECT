-- Koreksi kategori Gas pada petty_cash_expenses Oktober 2026 (disetujui user 2026-10-27).
--
-- Konteks: kategori `gas` ditambahkan ke admin-dashboard pada 17 Okt 2026,
-- tetapi belum tersinkron ke dropdown POS Kasir (`apps/pos-kasir`), `apps/finance`,
-- dan `apps/manager`. Akibatnya, 84 transaksi pembelian gas/LPG pada 10-26 Okt 2026
-- tercatat sebagai `pengeluaran_outlet` (80 baris, Rp 4.088.000), `bahan_baku`
-- (3 baris, Rp 120.000), dan `transport` (1 baris, Rp 115.000) ? total Rp 4.323.000.
-- Selain itu, 1 baris `es batu kristal` (Rp 20.000) tercatat sebagai `gas` dan
-- dikembalikan ke `bahan_baku` (Bahan Baku Lainnya).
--
-- Dampak ke total pengeluaran: Rp 0 (seluruh kategori asal maupun tujuan berada di
-- dalam allowlist OPEX Buku Kas; total petty cash aktif Oktober 2026 tetap Rp 47.977.513).
-- Bulan Agustus & September 2026 SENGAJA tidak disentuh (periode tutup buku).
-- Update menyasar `id` spesifik agar deterministik dan mudah diaudit.

BEGIN;

-- 1. Reklasifikasi pembelian gas/LPG ke kategori 'gas' (84 baris, Rp 4.323.000)
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'db9e9cf5-dd38-4d6d-82db-c778bae76fcd'; -- 2026-10-10 | dari:pengeluaran_outlet | MITRA CISEENG | "lpg 2tabung" | Rp 46.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '1e7561eb-bd04-41ae-ab63-9e7ef0c50715'; -- 2026-10-17 | dari:bahan_baku | SUKA SHAWARMA JAGAKARSA | "gas" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '6e766ba5-5be4-4c01-b59f-1d9b875f5f98'; -- 2026-10-17 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "gas 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'b105483e-7bf7-465b-b96b-f26d8d834577'; -- 2026-10-17 | dari:pengeluaran_outlet | SUKA SHAWARMA BEJI | "isi ulang gas 4 tabung" | Rp 88.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'b7b13a63-aee3-4aa1-a413-4a82099b87fb'; -- 2026-10-17 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'bbaa476e-1b48-4a5b-b043-26381495a240'; -- 2026-10-17 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'dce93c5e-9bf5-4647-9f0a-93750529e002'; -- 2026-10-17 | dari:pengeluaran_outlet | MITRA CIBINONG | "Gas 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'df959f25-c964-4c49-a9cf-de3c0f5ca61c'; -- 2026-10-17 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "Gas Melon" | Rp 110.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'ef68591d-39d2-4a6c-a5bf-fde185679742'; -- 2026-10-17 | dari:pengeluaran_outlet | SUKA SHAWARMA CIRENDEU | "gas 2" | Rp 40.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'f59bab50-75ae-48eb-b4be-09d203dbc0ab'; -- 2026-10-17 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '0a67da0d-4327-45f1-8801-f983161943f2'; -- 2026-10-18 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "beli gas 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '11bf09bc-e3a7-423d-a7c6-5242fc4ba0ba'; -- 2026-10-18 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '4faa6d95-7628-43b2-b524-a3f96e02df2b'; -- 2026-10-18 | dari:pengeluaran_outlet | SUKA SHAWARMA PAJAJARAN | "gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'd14fa541-8b37-4f06-a5ac-eee42027ff4c'; -- 2026-10-18 | dari:pengeluaran_outlet | MITRA CICURUG | "gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '1f362675-ad9a-4c48-9a40-9ddd1d568da2'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "gas" | Rp 110.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '367190ea-5744-42fa-86c5-8a5bdcf39285'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA CIBINONG | "isi ulang gas 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '58a2540b-89c1-4055-87da-c87adbbc8712'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA SENTUL | "gas lpg 4tabung" | Rp 80.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '69dffdf8-4d5b-4277-8bad-e872d7ff17c5'; -- 2026-10-19 | dari:pengeluaran_outlet | SUKA SHAWARMA EMPANG | "gas 8" | Rp 184.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '6cd65896-f4a8-41e4-b71b-81c87da74d1a'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '8dff7569-d8c1-4215-a29d-acd94d34f9fe'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas elpiji x4" | Rp 88.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '8edae3fc-c732-4faa-8951-27f8904353b2'; -- 2026-10-19 | dari:pengeluaran_outlet | SUKA SHAWARMA PAJAJARAN | "isi 2 tabung gas" | Rp 50.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'c5e5a0c9-27e0-4b92-94a7-0d18db5b4655'; -- 2026-10-19 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "gas 1" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'dd9e3710-e0fb-491f-ad36-1301e51e33b4'; -- 2026-10-19 | dari:pengeluaran_outlet | SUKA SHAWARMA BEJI | "pembelian gas" | Rp 88.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'e2716136-159c-43d3-a69d-c1eb54da6757'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA CICURUG | "gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'e63318e0-5d27-40aa-b11c-d090dc392bee'; -- 2026-10-19 | dari:pengeluaran_outlet | MITRA PEKAYON | "beli gas 6" | Rp 120.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '26cd3cd4-ca00-47d6-b4b7-a469fb210690'; -- 2026-10-20 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '6dc49781-4b2e-4431-9150-7040a3a4baa9'; -- 2026-10-20 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "beli gas 1" | Rp 23.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '8f88f9e4-a24b-4db7-8dcb-7b7eadaed0af'; -- 2026-10-20 | dari:pengeluaran_outlet | SUKA SHAWARMA CIMANGGU | "gas x7" | Rp 154.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a8707dad-9ed8-4a4c-92d6-b284393aa599'; -- 2026-10-20 | dari:pengeluaran_outlet | MITRA KALISARI | "gas lpg 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'b26c96af-91fb-4ff8-b737-8a4db8fcd52e'; -- 2026-10-20 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '027b1391-c2a5-4a30-ad10-c0c73c017526'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA BEJI | "isi ulang gas 2 tabung" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '31437eb0-9504-43d4-8405-f58ed024563c'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "gas 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '7e33869e-15ec-4670-b779-1c1bb3a95641'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '830501fe-c31e-48c2-b813-3cd2044b86b0'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "beli gas 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '87b9a685-af97-41ab-a930-6f86e024e1f7'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "beli gas 1" | Rp 23.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '9866ff69-d67c-4b13-b12b-2160b0c1bfbd'; -- 2026-10-21 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji 2 tabung" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a1cb5ce4-bfae-47ed-844c-99d8fa7f3065'; -- 2026-10-21 | dari:pengeluaran_outlet | SUKA SHAWARMA CIRENDEU | "gas 3" | Rp 60.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'da2d7564-5534-4472-b301-421b5824c50b'; -- 2026-10-21 | dari:pengeluaran_outlet | MITRA CIBINONG | "GAS 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '25e45ee3-2362-4b62-a64e-f8f1854f5729'; -- 2026-10-22 | dari:pengeluaran_outlet | MITRA CIBINONG | "isi ulang gas 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '2f2d6375-2dcf-4327-a04e-e9b4d783bd49'; -- 2026-10-22 | dari:bahan_baku | SUKA SHAWARMA JAGAKARSA | "gas" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '366072ca-e281-4749-adaa-160e5cc7cdbd'; -- 2026-10-22 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '49500a06-8bd0-4125-a092-63b755955093'; -- 2026-10-22 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "gas melon" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '50a2b704-4ff5-4e9f-a3f4-597a7bcb974b'; -- 2026-10-22 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "gas 1" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'cc780743-17d8-4d88-bc5a-e03e8b81171a'; -- 2026-10-22 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas elpiji x2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'd24d161d-c70c-438c-af86-435aa00f9b56'; -- 2026-10-22 | dari:pengeluaran_outlet | SUKA SHAWARMA PAJAJARAN | "isi ulang gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '310df90e-d965-492c-a677-626582713f09'; -- 2026-10-23 | dari:pengeluaran_outlet | MITRA SENTUL | "gas lpg 4tabung" | Rp 80.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '4950d575-c8c9-4916-bf41-56459d78af74'; -- 2026-10-23 | dari:pengeluaran_outlet | SUKA SHAWARMA BEJI | "isi ulang gas 4 tabung" | Rp 88.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '4b7bed83-aa1e-458c-8446-814be9f4c74c'; -- 2026-10-23 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'ace76f15-84db-4ac3-9a71-fc26df2d4ae6'; -- 2026-10-23 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "gas 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'b7b35008-7631-4687-92ee-f1d9ae648272'; -- 2026-10-23 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "Gas melon" | Rp 110.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'c8eafc64-aa57-4a33-96c5-3f12943c975e'; -- 2026-10-23 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas elpiji x2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'c9e1a332-3786-477e-8a33-d4f27b833333'; -- 2026-10-23 | dari:pengeluaran_outlet | SUKA SHAWARMA CIMANGGU | "gas x6" | Rp 132.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'd50c0714-6b47-4e57-9f1c-6d2a937c7aad'; -- 2026-10-23 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '0440e555-517e-49eb-9a48-00a18ea379d2'; -- 2026-10-24 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "gas 1" | Rp 23.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '0cf4e1f4-4c14-4eb7-b4d6-d5ba7b9cf388'; -- 2026-10-24 | dari:pengeluaran_outlet | MITRA CIBINONG | "gas 2" | Rp 46.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '1a82c443-a6fd-4e65-8a93-3ee912dc894d'; -- 2026-10-24 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '3834f26e-d842-4fe3-9866-c534f7c82cc4'; -- 2026-10-24 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '3df99ede-c7cb-458a-a39a-2a964ba38b2e'; -- 2026-10-24 | dari:pengeluaran_outlet | MITRA KALISARI | "gas lpg 2" | Rp 46.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '6bd5276a-d379-4270-bbf1-e42237368023'; -- 2026-10-24 | dari:pengeluaran_outlet | SUKA SHAWARMA DRAMAGA | "beli gas 3" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '6e906808-ed8a-44d9-9228-c302d437c95c'; -- 2026-10-24 | dari:pengeluaran_outlet | SUKA SHAWARMA CIRENDEU | "gas 2" | Rp 40.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '97f0afc4-3795-4cba-910c-6eb921930774'; -- 2026-10-24 | dari:pengeluaran_outlet | SUKA SHAWARMA PAJAJARAN | "isi ulang gas 2x" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'd9595819-fd89-40df-8a28-b673330d45fa'; -- 2026-10-24 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas x2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'e333fc1b-c851-4ce6-96dc-e4923cd44d2d'; -- 2026-10-24 | dari:transport | SUKA SHAWARMA EMPANG | "gas 5" | Rp 115.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '0050cce5-dd65-40a8-b515-4b4bf1a6aa2a'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA CIBUBUR | "gas kosong" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '315b06f1-9399-4e65-8eca-cc9bed09f31c'; -- 2026-10-25 | dari:pengeluaran_outlet | SUKA SHAWARMA DEPOK SUKMAJAYA | "Gas" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '3d53b921-b563-4e56-9706-8b4d69a9ed96'; -- 2026-10-25 | dari:pengeluaran_outlet | SUKA SHAWARMA BEJI | "isi ulang gas 2 tabung" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '46f5509d-706a-4dd6-a48a-5e4223affd9b'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "gas melon" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '51cd036f-80e1-4f3d-a14b-ff98ae76a85c'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA CICURUG | "gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '7dd34869-7348-4fe9-9b2d-c36e1e6f2385'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas x1" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a4cac09f-cb36-4583-82c1-e6ad0fb6fbf4'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA CIBINONG | "isi ulang gas 2" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a91ec0a8-f831-414b-ae18-f18bc0ea5933'; -- 2026-10-25 | dari:bahan_baku | SUKA SHAWARMA JAGAKARSA | "gas" | Rp 24.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'd6b4217c-af16-4c1e-8213-fa869f62900f'; -- 2026-10-25 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji 2 tabung" | Rp 44.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'fdea9d14-5718-494c-87c7-6216c449be38'; -- 2026-10-25 | dari:pengeluaran_outlet | SUKA SHAWARMA CIRENDEU | "gas" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '0d6bd36d-d537-49bb-be26-2455c2f68de7'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA CIBINONG | "isi ulang gas 1" | Rp 24.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '5885d83d-1a0d-45f3-8af7-65900f306548'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA CILEUDUG | "gas x1" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = '7b6b2a8a-dba7-4c24-bb2b-a72e8f94ba88'; -- 2026-10-26 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "beli gas 1" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a065449d-62b1-4139-8912-b9b75ae16f7d'; -- 2026-10-26 | dari:pengeluaran_outlet | SUKA SHAWARMA PAJAJARAN | "isi 2 tabung gas" | Rp 50.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a60e0efc-e4bf-4a4d-8bdf-d4a04e0feafd'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA PONDOK AREN | "gas" | Rp 21
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'a84c772e-02b7-44ef-813f-87f7d32a3b08'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA CILEUNGSI | "gas melon" | Rp 66.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'c4468ae2-c8d5-47b7-8ff6-53eb4445933c'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA CICURUG | "gas 2" | Rp 48.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'e366ef0b-9e2a-4451-857c-9d006a36856a'; -- 2026-10-26 | dari:pengeluaran_outlet | SUKA SHAWARMA JATIWARINGIN | "beli gas tgl 25/10/2026" | Rp 22.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'ed4579d1-4063-4ee4-b5ac-29c35942b219'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA KALISARI | "gas lpg 2" | Rp 46.000
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'f0bdb2e5-cc6a-4889-8c70-42e10a70fd54'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA PONDOK AREN | "gas 1" | Rp 20.979
UPDATE public.petty_cash_expenses SET category = 'gas' WHERE id = 'fb28f76c-bba7-480b-9be7-c6697f626f5d'; -- 2026-10-26 | dari:pengeluaran_outlet | MITRA PAMULANG | "gas elpiji" | Rp 22.000

-- 2. Koreksi salah pilih kategori 'gas' untuk non-gas ke 'bahan_baku' (1 baris, Rp 20.000)
UPDATE public.petty_cash_expenses SET category = 'bahan_baku' WHERE id = 'd475568d-a838-4c5c-b995-20604a54b58d'; -- 2026-10-26 | dari:gas | SUKA SHAWARMA CIRENDEU | "es batu kristal" | Rp 20.000

COMMIT;
