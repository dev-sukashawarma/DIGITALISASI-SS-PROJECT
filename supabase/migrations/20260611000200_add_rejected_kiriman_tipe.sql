-- Tambah tipe 'rejected_kiriman' ke check constraint ledger_stok.
-- Dipakai untuk audit trail item rusak saat verifikasi surat jalan:
-- qty=0 (tidak masuk stok), catatan mencatat qty & alasan penolakan.

alter table ledger_stok drop constraint ledger_stok_tipe_check;
alter table ledger_stok add constraint ledger_stok_tipe_check
  check (tipe = any (array[
    'terima_kiriman',
    'pemakaian',
    'waste',
    'adjustment',
    'opname_selisih',
    'transfer_keluar',
    'transfer_masuk',
    'rejected_kiriman'
  ]));
