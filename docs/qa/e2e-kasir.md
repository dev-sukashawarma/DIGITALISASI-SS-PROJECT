# E2E Test — Role `kasir`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **kasir** (1 outlet).
> Jobdesk: Operator kasir — transaksi & shift di 1 outlet.

## Cakupan
kasir akses **pos-kasir** + **absensi** (clock in/out diri). Tidak akses stok,
distribusi, owner, admin. Tidak boleh ubah harga/menu/master.

---

## TC-KAS-01 — Login & launcher
- [ ] Login portal → launcher menampilkan: **POS Kasir, Absensi**.
- [ ] Tidak ada kartu stok / distribusi / owner / admin.

## TC-KAS-02 — Buka shift
- [ ] `/kasir/menu` → daftar menu outlet tampil.
- [ ] ⚠️ (ubah data) Buka shift kasir → status shift aktif.

## TC-KAS-03 — Transaksi / checkout
- [ ] Tambah beberapa item ke keranjang → subtotal benar.
- [ ] `/checkout` → ⚠️ (ubah data) selesaikan transaksi uji (tunai).
- [ ] (opsional) Bayar QRIS (`/api/qris-simulate`) → status lunas. ⚠️ (ubah data)
- [ ] Nomor order ter-generate per outlet (tidak bentrok antar outlet).

## TC-KAS-04 — Histori & tutup shift
- [ ] `/kasir/histori` → transaksi tadi muncul (outlet sendiri saja).
- [ ] ⚠️ (ubah data) Tutup shift → rekap total sesuai transaksi.

## TC-KAS-05 — Absensi diri
- [ ] Clock in/out diri sendiri berhasil. ⚠️ (ubah data)

## TC-KAS-06 — Batasan
- [ ] `/admin/*` (menu, users, settings) → ditolak / tidak terlihat.
- [ ] Stok → ditolak.
- [ ] Distribusi → ditolak.
- [ ] Owner / Admin Dashboard → ditolak.
- [ ] Data outlet lain tidak terlihat di histori.

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Menu kosong / outlet salah | Outlet kasir tak ter-set / produk belum sync ke outlet | Cek `outlet_staff.outlet_id`; sync menu outlet (`/api/admin/outlets/sync-to-online`) |
| Checkout gagal / order tak tersimpan | Browser client anon (write tanpa sesi) atau RLS isolasi outlet | Pakai `@suka/auth` client; cek RLS isolasi outlet (`migration-outlet-isolation.sql`) |
| Nomor order bentrok antar outlet | Sequence order tidak per-outlet | Cek `migration-order-number-per-outlet.sql` |
| kasir bisa buka `/admin/*` | Guard route admin POS lemah | Catat sebagai bug; pos-kasir TANPA middleware SSO portal (cek di app-level) |
| Histori menampilkan transaksi outlet lain | RLS isolasi outlet bocor | **Bug** — laporkan |
| Absensi clock-in tertolak | Wajah belum enroll / di luar jam | Enroll dulu; cek `outlet-config` jam |
| kasir tidak ditolak saat buka pos-kasir? selalu boleh | Benar — kasir memang punya akses pos-kasir | (bukan bug) |

> Catatan: **pos-kasir tidak punya middleware SSO portal**. Untuk role yang harus
> ditolak dari pos-kasir, penolakan diverifikasi di level launcher/app, bukan redirect.

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
