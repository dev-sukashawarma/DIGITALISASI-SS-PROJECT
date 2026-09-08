-- Koreksi bucket kategori petty cash Agustus 2026 (disetujui owner 2026-09-08).
--
-- 230 baris dipindah ke kategori yang sesuai isi keterangannya, + 2 baris
-- belanja campuran yang DIPECAH jadi dua (lihat blok terakhir).
--
-- TOTAL pengeluaran Agustus TIDAK BERUBAH (tetap Rp 52.912.214) — semua baris
-- ini sudah dihitung sebagai biaya sebelum & sesudah skrip ini. Yang berubah
-- hanya sebarannya antar kategori. Laba & bagi hasil tidak tersentuh.
-- Catatan: jumlah BARIS Agustus bertambah 2 karena pemecahan di blok terakhir.
--
-- Dikecualikan atas keputusan owner (tetap Outlet):
--   * "sikat dorong, lap dapur, ... , parkir" (parkir cuma 1 item nempel)
--   * "Iuran listrik air" (iuran, bukan tagihan listrik/air)
-- Dikecualikan karena salah tangkap pola: "2 botol air mineral ..." ("botol"
-- mengandung "tol"); pola sudah diperbaiki jadi batas-kata.
--
-- Update menyasar id spesifik, bukan kondisi kategori/teks.

BEGIN;

-- Internet: 2 baris, Rp 30.000
UPDATE public.petty_cash_expenses SET category = 'internet' WHERE id IN (
  'f9fb7b5c-9fc6-4fe6-bb81-5f76e4094318',  -- Rp 15.000    kuota 5 wifi eror
  '3612d43c-0905-4cbf-9f06-9d58824fcf35'  -- Rp 15.000    voucher data\backup wifi error
);

-- Overtime: 32 baris, Rp 2.950.000
UPDATE public.petty_cash_expenses SET category = 'lembur' WHERE id IN (
  'fad0e233-33ee-4d5b-ae64-c1feea2542d1',  -- Rp 100.000   distribusi timbangan dan sosialisasi stock opname da
  '75e72352-6862-45b1-b2d5-307ad580337e',  -- Rp 50.000    lembaran daut kemarin 17 agustus
  '3eece238-a2c0-4958-8c79-c20132dd7004',  -- Rp 50.000    lembaran omzet
  'd2c427eb-ebc7-48d3-9bbc-c014cb01b743',  -- Rp 50.000    lembaran omzet
  '0f4509de-e0aa-4139-9c43-70a3e3b9bf7b',  -- Rp 50.000    lembaran rifki
  '944a4ea9-e5d7-4a44-8eac-0e86b4322023',  -- Rp 50.000    lembur am
  'ce6b5823-e5fe-45e9-925b-cfab28a193cf',  -- Rp 100.000   lembur bulanan muhtar bulan juli
  'b4f6c2ec-448e-43a4-be4e-0e00a73edd3a',  -- Rp 50.000    lembur chairul tgl 4-8-2026
  '333d8273-2654-4f5c-9af8-76748a19d2ef',  -- Rp 50.000    lembur dika
  '65ca1810-dd0f-4bfe-82d5-b555e06507de',  -- Rp 150.000   lembur meeting latihan apar 3 orang
  '6feaa889-781e-4bdf-affe-c5185bef2a73',  -- Rp 100.000   lembur omset 5jt 2 orang
  'd3883cc1-996b-4b28-8140-ecc2b352b933',  -- Rp 50.000    lembur opname kamaren tgl 31 juli
  '897e14e8-d188-42b4-a759-0e687ce8d400',  -- Rp 150.000   lembur pelatihan damkar ×3 orang
  'd793012d-8a01-49d7-bc7a-0723d58c5624',  -- Rp 50.000    lembur reno
  'a8a6a710-e7e9-4c42-93f4-2cf44178af73',  -- Rp 50.000    lembur sayid
  'cee71987-1a71-4a2b-bc7c-8ee843b89f58',  -- Rp 150.000   lemburan 3 orang
  '40da6373-1bf7-446e-96d5-e3576fe996e3',  -- Rp 150.000   lemburan 3 org
  'c37be4a4-f4e6-4c4a-b726-539b47412fd2',  -- Rp 300.000   lemburan 6 orang
  '9bace838-9316-4eb0-8387-cdc1f2aab22a',  -- Rp 100.000   lemburan am chairul 2 hari
  '616caf63-0204-4aab-b8c5-3e65b2ca957b',  -- Rp 50.000    lemburan kak chairul
  '74070250-72b5-407e-8963-a786218d231b',  -- Rp 150.000   lemburan noval sahrul zaki ikut pelatihan apar
  '72b89009-4d03-4e49-94b6-b44f2d4ab818',  -- Rp 50.000    lemburan omset tgl 11
  'ab6ba715-6bd5-4897-8566-0344740a0dc4',  -- Rp 150.000   lemburan omset tgl 26-08-2026
  'a5c0efa1-6dc0-47f6-832b-5816f7c10846',  -- Rp 50.000    lemburan orderan sayyid
  'd4806eff-c681-4991-8e6f-75455772fe3e',  -- Rp 150.000   lemburan outlet sayyid, irwan , syarif
  '90fb4b4f-58bb-4069-be9b-45ffbaa3e543',  -- Rp 50.000    lemburan rizki
  '58539974-f033-4539-8279-253b21a29442',  -- Rp 50.000    lemburan umam
  '1251e27e-aad7-4bd7-84e4-f55f0e63bd90',  -- Rp 200.000   lemburqn omset 30 agustus 2026
  'c56fa188-083c-4c0c-88d7-927a22374ac1',  -- Rp 50.000    uang lembaran omset hendri
  'ae3f1501-a6b0-4660-87ee-2d96f7d4b49b',  -- Rp 50.000    uang lembur am tgl 04-04-2026
  '03ec431c-afff-4544-9662-6f2863635e59',  -- Rp 100.000   uang lembur omset yunus / daud
  '1628bb1c-2b72-48c4-a60d-3e620e4e682a'  -- Rp 50.000    uang lembur omzet (yunus)
);

-- Air (PDAM): 1 baris, Rp 50.000
UPDATE public.petty_cash_expenses SET category = 'pdam' WHERE id IN (
  'de194b5a-49ae-46ba-bf44-0cae593753f8'  -- Rp 50.000    meteran air
);

-- Listrik (PLN): 56 baris, Rp 6.609.986
UPDATE public.petty_cash_expenses SET category = 'pln' WHERE id IN (
  'c6ffae4e-a2ed-485c-9247-127eeff9ea6c',  -- Rp 269.086   bayar listrik
  'db93ea42-74d0-4929-9397-a021281a2073',  -- Rp 54.500    bayar listrik
  '866a65d4-87b0-43ac-9248-a0da8b70f28f',  -- Rp 105.000   bayar listrik tgl 06 08
  'cc4e38d3-b03d-4f74-9f91-138471868af3',  -- Rp 104.000   bayar token listrik
  'c60b8754-9100-44c9-976a-b65b4b7d62f7',  -- Rp 104.000   beli token +admin
  '3be5f6da-ee8a-4d52-8dcb-6dcfdfbe779b',  -- Rp 103.500   beli token listrik
  '9d1911c3-f035-4fe8-afe9-bbebc0526b69',  -- Rp 105.000   beli token listrik
  'be77e1d8-ea7c-4de7-9563-554b15a2f75a',  -- Rp 102.000   beli token listrik
  'c7e327ff-f930-4539-a7e1-3699568e9046',  -- Rp 102.750   beli token listrik
  'ebc4bbef-cd91-4e87-876d-e98e4b99389a',  -- Rp 101.500   beli token listrik
  '092e1ad3-5782-41ae-8f65-73400bd9f673',  -- Rp 105.000   isi token listrik
  'b6ef3445-c029-4374-934a-b916c12e854e',  -- Rp 102.750   isi token listrik
  'b24e22c4-a1f5-4f17-af18-f2541cb78633',  -- Rp 201.500   isi ulang token
  '8e99aec7-cd23-416f-8fd0-9d1ee2f9e186',  -- Rp 105.000   isi ulang token listrik
  '18bdf531-98bc-4bd7-82a5-479b51867a52',  -- Rp 103.000   listrik
  'c25c7daf-3edb-4f07-b4a1-792bb2cc78b5',  -- Rp 21.400    listrik
  'ca0fd1e5-fa46-4c0c-9c71-a4802b07726e',  -- Rp 200.000   listrik dapur
  'c2b3be6a-641f-4b5a-8167-0cc67d7959c9',  -- Rp 54.500    listrik dramaha
  '8ce17310-3fe1-4146-9f03-710a31903a63',  -- Rp 203.000   pembayaran token listrik
  'f62cc093-5104-421b-9aa1-9a9c24d70d1d',  -- Rp 203.000   pembayaran token listrik
  '5fad37e9-3298-4ca8-b735-58c58bdcf42e',  -- Rp 102.000   tokej listrik
  '388ce35d-3700-42ad-88c8-25d4eb0e9008',  -- Rp 102.000   token
  '91c26c65-f357-468a-aa66-cd542aa3a9b5',  -- Rp 102.000   token
  'fc0cd58d-55ba-4ffa-965b-f89fad028088',  -- Rp 102.000   token
  '4d27e326-194d-49cd-b4bf-17b0b531c1c3',  -- Rp 105.000   token liistrik
  '01a740a9-d1d0-4e20-b77e-b8acd6e6dbd4',  -- Rp 103.000   token listrik
  '047189e0-e5a5-4f57-a596-9fc27f28dadc',  -- Rp 104.000   token listrik
  '179c6026-66f9-4e8f-9461-ddd61f13beea',  -- Rp 105.000   token listrik
  '350f013f-7296-4563-82c7-e244984d555c',  -- Rp 101.000   token listrik
  '4481c16b-9d97-4955-a70b-2eeeb453e75c',  -- Rp 54.000    token listrik
  '44f60071-0ca7-47ca-8a23-dd25374b2b31',  -- Rp 104.000   token listrik
  '45d205c5-52b6-465b-a27e-1eda86019f68',  -- Rp 201.500   token listrik
  '5460255c-115a-4304-b536-6162991d3ce4',  -- Rp 104.500   token listrik
  '5a90b899-9978-4c97-85ee-157a326a9a1c',  -- Rp 54.500    token listrik
  '6339f0bf-3f19-4765-8c6d-d9b29d92a84b',  -- Rp 50.000    token listrik
  '63af7275-2ad9-4f33-86fa-a77e49447df1',  -- Rp 104.500   token listrik
  '64d37fd7-4117-4322-8bf7-1bdc716cdfa7',  -- Rp 104.500   token listrik
  '6ad24937-c221-4fc4-8bb7-c83d432c757f',  -- Rp 104.500   token listrik
  '6e4a981c-5080-4221-8cff-23fa604571fd',  -- Rp 105.000   token listrik
  '73cea712-68e5-4b29-b608-1b4db2f9edce',  -- Rp 203.500   token listrik
  '7ab74137-d046-4dec-83ad-ea1b31ff1c81',  -- Rp 101.500   token listrik
  '8ab03715-82ac-4c59-8316-e0420f3f377c',  -- Rp 204.000   token listrik
  'a67fd024-f0aa-4961-9e4d-ffbc2f673253',  -- Rp 53.000    token listrik
  'bf77e491-872d-4721-8b49-cd9ac98e26ee',  -- Rp 101.000   token listrik
  'c052d6a8-96a0-49c9-9f0c-8ee7464589d1',  -- Rp 201.500   token listrik
  'ccc87970-6911-4ae7-a7e1-b23685f04228',  -- Rp 104.500   token listrik
  'ce2ed73a-5d37-4bb4-bfa6-3236d0207953',  -- Rp 104.500   token listrik
  'e39fc334-7292-494e-9a24-08831b7e335f',  -- Rp 51.500    token listrik
  '49a8a77c-c327-48d8-8286-5d6bc304ec24',  -- Rp 203.500   token listrik bakaran
  'e9bfba2d-cd6b-4c26-aeb5-ecfdeabcbe5d',  -- Rp 201.500   token listrik beji
  '9374fc9c-2006-4f33-bfce-5def47670f94',  -- Rp 203.500   token listrik mess
  '36aae21b-e835-441c-be3f-44ded8e97e89',  -- Rp 104.000   token listrik shawarma
  '04ae8482-4ed5-4c79-be13-145d28842828',  -- Rp 104.000   token+admin 3rb
  'a0d0ef58-c863-4f27-a10c-0447490e2087',  -- Rp 100.000   topeng listrik
  '22751a4b-fa20-490c-aae7-6b4fd9d6624e',  -- Rp 103.000   topeng listrik 100k
  '6f08ccd2-adc7-4fe4-b879-e37c172acc29'  -- Rp 102.000   topeng listrik 100k
);

-- Transport: 139 baris, Rp 5.763.500
UPDATE public.petty_cash_expenses SET category = 'transport' WHERE id IN (
  '1b735e46-920f-4b44-aef2-df8d0c2baaf3',  -- Rp 16.000    bayar lalamove
  '224755c9-ecbc-4c0a-8616-a79b863cede7',  -- Rp 138.000   bayar lalamove
  '73dc35ff-54df-4569-82bb-79759c1d6c2c',  -- Rp 15.000    bayar lalamove
  'd5f0b84c-5a10-4bc1-bbb3-bdae2487f47d',  -- Rp 15.000    bayar lalamove
  'edacf728-036a-41cd-aae4-9526caac5589',  -- Rp 15.000    bayar lalamove
  'fadf7c62-a52d-4cde-af16-4c31cc37a7b0',  -- Rp 17.000    bayar lalamove
  'e346f258-5280-4eff-8b2e-3c4dc86de2c1',  -- Rp 10.000    bayar lalamove antar pesanan uang dah di tf ke kanto
  '33d96135-3a44-4c63-a030-feef49262f25',  -- Rp 82.000    bayar lalamove bahan baku tgl 09-08-2026
  '776bb7bf-ff71-49ac-affb-a543133b4ec1',  -- Rp 101.000   bayar lalamove,
  '34a2b3ec-aac9-4e09-baf4-eac5e6b5db0b',  -- Rp 10.000    bensin antar omset
  'b20b9b78-905a-4a0d-88c6-132154300469',  -- Rp 10.000    bensin bahan baku
  '75eba919-a0db-4951-9a27-92e58e34dda8',  -- Rp 15.000    bensin beli kabel data cctv
  '21a37955-642b-4a51-ab6d-693cb4f161ea',  -- Rp 15.000    bensin beli kp 2 dan pisau 2
  '699af9d2-5232-4ef2-b084-5148fe5e6022',  -- Rp 20.000    bensin transport
  'ab40c3b6-0c93-407d-972a-bc1f3a2353aa',  -- Rp 20.000    bensin transport
  '0d60602b-657e-4b4f-ba41-72a9265070da',  -- Rp 115.000   driver lalamove
  '653bc2e2-f22f-4a18-b28e-5916b6d6f5e5',  -- Rp 63.500    driver lalamove
  'a7fc0302-c9a7-4835-a84c-4f8afd0d5ed4',  -- Rp 30.000    e-toll lalamove kitchen
  '07703573-7932-44cb-a05f-f83722f0c453',  -- Rp 15.000    lalamove
  '0941c004-452a-4d5f-be3b-54cb84df6202',  -- Rp 21.000    lalamove
  '23a85082-d35f-40a2-8adc-2f09ba0bc38c',  -- Rp 112.000   lalamove
  '2f66a2e2-c4f7-44da-b07b-dd6ba801ae84',  -- Rp 87.000    lalamove
  '39cb6e57-e76b-4084-9359-5eedc0e9c07e',  -- Rp 63.000    lalamove
  '3db66275-c915-481d-b2ce-0d83382a1346',  -- Rp 114.000   lalamove
  '4c21341e-73db-4f74-9b9f-05037c514562',  -- Rp 127.000   lalamove
  '4d24480b-f2f6-4bbc-b73c-c4ee880593d1',  -- Rp 108.000   lalamove
  '4f5e0a91-81ba-48be-bd3d-eb5a6d0eea3c',  -- Rp 58.000    lalamove
  '5aa44afa-3f7a-4d63-b88c-29dba720257c',  -- Rp 11.000    lalamove
  '6a6988f5-1228-4130-97ea-df0d7affeb2a',  -- Rp 10.000    lalamove
  '6b7b1b0f-1790-4187-aeaf-1b432853791f',  -- Rp 39.500    lalamove
  '6d76c8e6-4567-47c0-9333-eca9cd570a8e',  -- Rp 25.500    lalamove
  '7b2613fc-ef49-4474-b941-2bd4ca6536d7',  -- Rp 32.000    lalamove
  '80e203d8-8044-480d-9eae-615be56f6ded',  -- Rp 80.000    lalamove
  'abee2afe-07d8-4fab-9378-129ac8f533c2',  -- Rp 138.000   lalamove
  'b0f0ff88-8d03-46d1-987f-a736995f4184',  -- Rp 61.000    lalamove
  'b28703b8-92fa-484d-a8fc-6afba2e780e9',  -- Rp 55.000    lalamove
  'cd33d008-3890-4070-8b58-29f9be8096fa',  -- Rp 41.000    lalamove
  'e72662e5-e21f-4d24-8b58-f70254b8fb19',  -- Rp 71.000    lalamove
  '48f975f7-8ce0-4f44-9173-daf093521406',  -- Rp 11.000    lalamove 31 agustus 2026
  '648a9c5d-85ea-456e-a1b8-615d7453da4b',  -- Rp 42.000    lalamove antar bahan baku
  '939736de-d9ee-41f9-9f33-ec61b8f5baab',  -- Rp 165.000   lalamove antar barang
  '24d8707d-9390-4a01-94bc-1fe8c8769622',  -- Rp 40.000    lalamove antar kentang
  'a6c54272-02ea-4b3e-8076-ba4767d46634',  -- Rp 13.000    lalamove antar sapi dari bcc ke empang
  '076fe1e8-498a-4881-8980-854234db1a8e',  -- Rp 83.000    lalamove bahan baku
  '16e89b33-28b1-4918-bedc-b6c108e149f1',  -- Rp 12.000    lalamove bahan baku
  '174c8fa1-dc57-459e-b1e8-62d3de4ff7e1',  -- Rp 82.000    lalamove bahan baku
  '9f12a7d5-138a-4fc6-b9d5-6d7b35cd2d00',  -- Rp 41.000    lalamove bahan baku
  'a143ace8-b9bc-49a9-80a4-1f90053a8626',  -- Rp 42.000    lalamove bahan baku
  'a5c2fcda-6292-47da-b73c-489d8a441ab0',  -- Rp 121.000   lalamove bahan baku
  'd57a33f5-4648-4f07-b4f4-058417be8aa2',  -- Rp 126.500   lalamove bahan baku
  'e1676cc5-8335-45f8-b72c-d855ae7f1de8',  -- Rp 42.000    lalamove bahan baku
  'e4e12908-b968-4b76-b466-c263274e377d',  -- Rp 60.000    lalamove bahan baku
  'fd783f06-5a41-4be5-a6a8-e973dd1a4fbd',  -- Rp 42.000    lalamove bahan baku
  'b660005c-f637-480f-8199-22920d13a7a0',  -- Rp 80.000    lalamove bahan baku + etoll
  '639ebb69-a7e7-4b09-9dde-ce86c6d8523f',  -- Rp 64.000    lalamove bahan baku + tol
  '27fc2aeb-5ed4-49e5-8d2b-2e821b926aaf',  -- Rp 58.000    lalamove bahan baku ayam
  '4dd043d8-7103-43dc-82e6-a03e234aab5a',  -- Rp 92.000    lalamove bahan baku beji ke sukmajaya
  'e2d8e4fc-bbda-44fd-bf08-d679f139203b',  -- Rp 90.000    lalamove bahan baku beji ke sukmajaya
  '4642a0bf-3d8d-4296-9dce-beb4c24d5298',  -- Rp 84.500    lalamove bahan baku dan tol
  '7612f833-4dd2-4330-bdef-2297c743ff60',  -- Rp 90.000    lalamove bahan baku sama tol
  '8e2d546a-f533-4d76-9e8f-eb625856d982',  -- Rp 55.000    lalamove barang
  '9d2935de-5c85-4df6-91ce-57384e8fa84d',  -- Rp 60.000    lalamove barang
  '915941ec-8dea-479d-a0a0-a2839f35f0cb',  -- Rp 201.000   lalamove frezer+ etoll
  '0ac43bab-1d33-40df-8189-d77b41fc6d47',  -- Rp 16.000    lalamove jagakarsa - sukmajaya
  '9cfcbcb8-8177-4008-b559-eac8968db222',  -- Rp 13.000    lalamove kebab ke cs udah acc sama cs shawarma
  '1c14882b-73cb-4e68-b2e3-48b8e78b6d68',  -- Rp 92.000    lalamove kentang
  '7b418ebc-ce32-4467-bd40-51da8e9b787b',  -- Rp 60.000    lalamove kitchen
  '408b0c02-cb87-4540-8a9a-2da0682e5915',  -- Rp 56.000    lalamove kitchen - sukmajaya
  '5d967e11-0dd1-4e44-b4c8-40c4df54b7bb',  -- Rp 65.000    lalamove kitchen+e toll
  '391a1c46-abea-4331-9477-43ec5116dbe6',  -- Rp 10.000    lalamove ngirim sapi dari drmaga ke bcc
  '1fd9f0eb-12fa-4dbd-a62c-356b61e79e52',  -- Rp 60.000    lalamove sapi
  '82e56a8b-2822-4073-bbe7-e49f62bccea2',  -- Rp 21.000    lalamove sapi dari babakan madang
  '4c8a0576-47eb-44fe-b605-f9a2780b98b0',  -- Rp 10.000    lalamove sapi dari bcc
  'b4af421b-3ed8-45a0-8aa2-c25917a7e08d',  -- Rp 11.500    lalamove sayur dri bcc
  'c656641b-24a1-477e-8b8a-8de87f6cac6f',  -- Rp 28.000    lalamove timbangan
  'a9c2d0d0-0200-4dcd-b076-a99f5f566fe7',  -- Rp 61.000    lalamovebahanbaku
  'ba2b66f6-ddf5-42e2-a34b-6f76a3a3f523',  -- Rp 12.000    ongkir grab kesalahan menu pesenan
  'bd545d1a-f005-4d0f-b9d0-3339e48e5d1e',  -- Rp 3.000     parkir lalamove
  '159a8234-63d2-4e1e-84ae-fd5335e678db',  -- Rp 2.000     parkir motor jaya makmur
  '69338993-d6c4-4bea-8dcd-732c9bbe1cf0',  -- Rp 2.000     parkir setor tunai
  '78467da8-e27c-447b-b567-952378a37d55',  -- Rp 2.000     parkir setor tunai
  '365bb0c6-a404-4a9b-b1c4-d3f563f95482',  -- Rp 120.000   parkir, pengiriman & tol lalamove
  'a730714f-3b54-4950-9c61-27bec71f6409',  -- Rp 100.000   pembayaran member parkir 4 motor
  'a08a7990-7bc2-46f5-b16e-b314a97eb03f',  -- Rp 60.000    pengiriman bahan baku lalamove
  'fcd4c58a-bca9-49d9-abe8-691c3c606e49',  -- Rp 8.000     tambahan bensin tadi kurang 8rb
  'dc98d032-59f4-4d45-a161-6868a6555ecc',  -- Rp 50.000    transport  konten  29/8/2026
  'dc35f053-29d6-41c8-a2c4-5a55e223686e',  -- Rp 15.000    transport agung back up
  '9a522cb3-a586-40b3-8b22-f60dc3bafefd',  -- Rp 15.000    transport back crew
  'f3d25e12-424d-4d17-a294-bf70e2fc29bf',  -- Rp 25.000    transport back up
  '70d8ac9b-a232-477d-bdad-d2011d342daf',  -- Rp 25.000    transport backup
  'c9a9a753-de7b-4a11-b909-875865c0e5c0',  -- Rp 15.000    transport backup crew
  '4547488d-56a9-4bcd-aeb2-4760457b5bdc',  -- Rp 25.000    transport backup yunus
  '87185cce-85a8-4c5c-95ce-b19c37b0b9c0',  -- Rp 25.000    transport backup yunus
  'b538fa04-31c3-4510-9bcf-38e477749639',  -- Rp 25.000    transport backup yunus
  'e458256a-0f18-4325-bc10-19a5ed090ab8',  -- Rp 25.000    transport backup yunus
  '0feac704-8bf5-428b-83f9-0635c138ccf3',  -- Rp 15.000    transport bahan baku
  '10ac90df-b49a-4097-beea-ed6966acbb0d',  -- Rp 15.000    transport bahan baku
  '1e36fac4-1a5a-4836-8b37-7ea7784b69e7',  -- Rp 15.000    transport bahan baku
  '1f3f5b80-e009-4f31-a57c-881c98fe3732',  -- Rp 15.000    transport bahan baku
  '30805fbf-1825-44b5-ba45-084a0fcea94d',  -- Rp 10.000    transport bahan baku
  '5a19c183-2d81-44d9-90cd-6556d3637796',  -- Rp 15.000    transport bahan baku
  '62787144-e6c6-4eb0-a6b3-0d40e32be87b',  -- Rp 15.000    transport bahan baku
  'e09ca6fe-b7b7-47c3-b2d8-87fba937ccc0',  -- Rp 15.000    transport bahan baku
  'e54137a0-ba46-4ca9-bc0c-2479597034af',  -- Rp 15.000    transport bahan baku
  'bfab01db-90e9-4b22-a648-90968469da61',  -- Rp 15.000    transport bahan baku (jamal)
  '9c7d51b4-7386-48b0-b77d-5db14fd67f87',  -- Rp 90.500    transport bahan baku dari kitchen ke zatwar + biaya 
  'aeaa6a78-9128-4fb5-8dca-844ab634cab7',  -- Rp 25.000    transport cikal backup jatwar 3-8-26
  '1af0761a-52ec-4c41-8501-cf340a53415f',  -- Rp 30.000    transport eza
  'bb237f22-e32b-4a28-9eb1-99d5b279a6e6',  -- Rp 30.000    transport eza ke cicurug
  '0a6ae7e3-2e27-4946-84de-b04938bab8b2',  -- Rp 50.000    transport habib bahsin anter timbangan
  '40d3826f-bf2e-4207-b2bd-06f1129cae0d',  -- Rp 50.000    transport konten
  '3a4876de-e992-4f09-8c5d-99cf6b957808',  -- Rp 50.000    transport konten ci leungsi hbb bahsin tgl 06 08
  'a3cd1cc1-c21f-4abd-bc47-649b61b147a9',  -- Rp 10.000    transport omset ke paledang
  '8043f5a7-46b4-48b3-9187-641985083294',  -- Rp 10.000    transport pengiriman bahan baku
  '0055acca-41c9-41df-81b1-df968a95507a',  -- Rp 25.000    transport perbantuan
  '5b28c933-b24a-40cf-a1fd-4f71a7bb83ca',  -- Rp 20.000    transport perbantuan
  '4ee902e7-ff20-4c43-bb42-8e923e9a381f',  -- Rp 25.000    transport perbantuan rifan
  'a0c72977-9b2a-450d-b700-26fe9af0d535',  -- Rp 20.000    transport perbantuan rifan
  '1a8809ed-0143-4dac-abcd-d8fc00d290fb',  -- Rp 10.000    transport uang omset  dramaga - paledang sahrul
  '5762d721-ae7c-453f-976b-ea7f914e8355',  -- Rp 30.000    transportasi algi
  'a2abe316-8226-472c-ae97-f67f2724352f',  -- Rp 10.000    transportasi amtar omset
  '9aa96742-2ca8-465b-a0fd-97095faa02ad',  -- Rp 10.000    transportasi antar omset dramaga ke paledang
  '036a7872-99b7-44d4-a852-76dcb6a8f785',  -- Rp 10.000    transportasi antar omset dramaga paledang
  'bd1adfd3-c8e6-435b-90ee-1533c229e7c2',  -- Rp 10.000    transportasi antar omset dramaga paledang
  '54dbde9e-b2a6-4f90-b718-7530fede12bb',  -- Rp 10.000    transportasi anter omset
  '4d905ccd-f2a6-4a2a-be38-f220219ddc1b',  -- Rp 15.000    transportasi bahan baku
  '8abb1e4e-64d0-4a38-ba60-c507142bff3a',  -- Rp 15.000    transportasi bahan baku
  '3254c085-c670-4e6f-a19c-6c8a9993083f',  -- Rp 25.000    transportasi dika
  '6f8b402a-eed1-4a17-8b6c-f02c35e6b4a0',  -- Rp 15.000    transportasi habis bahsin
  '28f0ec87-a9c2-43d5-870d-1d3cb2079d61',  -- Rp 15.000    transportasi kitchen
  'ac5b7d25-6808-4066-bacf-47bce726517f',  -- Rp 15.000    transportasi kitchen
  'e8459acd-e380-4079-9930-796944855628',  -- Rp 15.000    transportasi kitchen
  '1c5a9df7-aaec-42f0-bdf0-af166acf2698',  -- Rp 25.000    transportasi konten
  '9638d54a-c570-465a-99d5-ffb7fc0969a3',  -- Rp 25.000    transportasi kontes habib bahsin
  'c24a92de-226d-42fc-acff-25dfe05e6e1e',  -- Rp 2.000     uang parkir setor tunai
  '5b64c644-01ba-4ea9-b2db-573de3c9466b',  -- Rp 15.000    uang transport bahan baku
  'e6ecc1cc-c413-43ab-96dd-d079aa75cd69',  -- Rp 50.000    uang transportasi area manager
  '9b95c2d8-cade-45df-8f66-038255d80c09',  -- Rp 15.000    uang transportasi back up
  '8f6ae4f5-8fc5-41d0-b1e6-61bae7d2a630'  -- Rp 15.000    uang transportasi bahan baku
);

-- ============================================================================
-- Pemecahan belanja campuran (pembagian nominal ditentukan owner).
-- Baris asli dikecilkan jadi porsi Outlet; porsi Transport jadi baris baru yang
-- menyalin outlet/tanggal/pembuat/struk dari baris asalnya. Jumlah tetap sama.
-- ============================================================================

-- "Duplikat konci 3 dan bensin" (Rp 75.000) -> Outlet Rp 50.000 + Transport Rp 25.000
INSERT INTO public.petty_cash_expenses
  (outlet_id, category, amount, description, expense_date, payment_source, created_by, receipt_url, type)
SELECT outlet_id, 'transport', 25000, 'Bensin (pecahan dari: Duplikat konci 3 dan bensin)', expense_date, payment_source, created_by, receipt_url, type
FROM public.petty_cash_expenses WHERE id = '761a8db6-4abe-4b39-86d9-c116c2112193';
UPDATE public.petty_cash_expenses
   SET amount = 50000, description = 'Duplikat konci 3 (pecahan dari: Duplikat konci 3 dan bensin)'
 WHERE id = '761a8db6-4abe-4b39-86d9-c116c2112193';

-- "Spatula kave + kain lap + transport 15k" (Rp 66.000) -> Outlet Rp 51.000 + Transport Rp 15.000
INSERT INTO public.petty_cash_expenses
  (outlet_id, category, amount, description, expense_date, payment_source, created_by, receipt_url, type)
SELECT outlet_id, 'transport', 15000, 'Transport (pecahan dari: Spatula kave + kain lap + transport 15k)', expense_date, payment_source, created_by, receipt_url, type
FROM public.petty_cash_expenses WHERE id = '6d46efdc-da72-4599-aa26-28bbd82e146c';
UPDATE public.petty_cash_expenses
   SET amount = 51000, description = 'Spatula kave + kain lap (pecahan dari: Spatula kave + kain lap + transport 15k)'
 WHERE id = '6d46efdc-da72-4599-aa26-28bbd82e146c';

COMMIT;
