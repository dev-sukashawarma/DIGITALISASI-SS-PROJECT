# 07 — Checklist Review

Salin ke deskripsi PR saat menyentuh query/tabel.

## Query & data
- [ ] Tidak ada `select` tanpa batas pada tabel yang tumbuh (cek `scripts/audit-query.sh`)
- [ ] Tidak ada `.limit(N)` sebagai "pengaman" yang diam-diam memotong data
- [ ] Filter, pencarian, agregasi, pagination terjadi di database
- [ ] `ORDER BY` punya tiebreak unik (`…, id`)
- [ ] Ada index yang cocok dengan `WHERE` + `ORDER BY`; tidak ada index kembar
- [ ] Rentang tanggal WIB & sargable (tidak membungkus kolom dengan fungsi di `WHERE`)
- [ ] Daftar id panjang lewat body RPC, bukan URL
- [ ] Data yang dikelompokkan → tabel rekap + trigger (bila dibaca sering)
- [ ] Error tidak ditelan menjadi data kosong

## Keamanan
- [ ] RPC baca `SECURITY INVOKER`; definer hanya internal + `SET search_path` + `REVOKE`
- [ ] Tidak ada policy SELECT `USING (true)` pada data pribadi/keuangan
- [ ] `anon` tidak punya akses ke tabel internal
- [ ] View di atas tabel ber-RLS `security_invoker = true`
- [ ] Diuji dengan login sungguhan per role (crew, leader, mitra, HR, finance, anon)

## Verifikasi
- [ ] Angka baru = angka lama (atau selisih dijelaskan)
- [ ] Dry-run di transaksi yang di-rollback lolos
- [ ] Uji beban sintetis untuk rentang panjang
- [ ] Migration terstempel di `schema_migrations`, timestamp tidak bentrok
- [ ] `tsc`, test, `next build` lolos

## Frontend
- [ ] Pagination + ringkasan dari server
- [ ] Pencarian di-debounce; filter berubah → halaman 1
- [ ] Realtime di-debounce & sadar filter; polling ≥ 60 detik
- [ ] Export mengambil semua baris sesuai filter (per batch)
- [ ] Tanggal/jam memakai zona `Asia/Jakarta`
