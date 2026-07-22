-- Mengubah satuan besar/stok GAS 3Kg dari pcs menjadi tabung sesuai instruksi

UPDATE bahan_baku
SET satuan = 'tabung'
WHERE nama = 'GAS 3Kg';
