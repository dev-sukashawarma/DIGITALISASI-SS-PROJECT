# Bot CEO — paket Finance 1 (utang PO, pengeluaran, setoran, selisih kasir)

**Tanggal:** 2026-10-08
**Status:** Disetujui (brainstorming 2026-10-08), belum dibangun
**Bergantung pada:** `docs/superpowers/specs/2026-10-08-bot-ceo-semua-app-design.md` (fondasi
scope per app + `pengecualian.ts`, live 2026-10-08).

## 1. Tujuan

Bot CEO menjawab pertanyaan finance harian dengan angka yang sama dengan layar:
utang supplier, pengeluaran, setoran, dan selisih kasir. Urutan paket diubah owner:
**Finance sebelum Sistem.**

## 2. Keputusan

| # | Keputusan |
|---|---|
| F1 | Finance dibagi dua. **Finance 1** (spec ini): utang PO, pengeluaran, setoran, selisih kasir. **Finance 2** (spec terpisah): laba per outlet **sama persis dengan halaman Laba Rugi**, lewat pemindahan logika `ProfitView` ke modul server yang dipakai halaman itu sendiri + uji "angka sebelum = sesudah". |
| F2 | **Utang** = PO yang barangnya sudah diterima (`sebagian_diterima`/`diterima_lengkap`) dan belum lunas (`payment_status <> 'paid'`), nilai = **nilai terima** (`total_nilai_terima`). PO yang belum diterima (bukan draft/batal) dilaporkan terpisah sebagai **komitmen** dengan nilai pesan. Sengaja berbeda dari angka "belum dibayar" dashboard Pembelian (yang mencampur keduanya). |
| F3 | **Setoran** dari halaman Setoran (`cash_transaction`, `source_type='cash_deposit'`, status `reconciled`/`paid`/`approved` — sama dengan app Finance). Pencatatan baru mulai 2026-10-08 (setoran nyata pertama: MITRA CIBINONG Rp430.000, tanggal jual 1 Okt). Bot **tidak boleh** menyimpulkan "outlet X belum setor"; data kosong = "belum ada setoran yang dicatat untuk periode itu". |
| F4 | **Selisih kasir** dari tutup shift POS (`shifts`). Nama kasir **boleh** ditampilkan (operasional, bukan data pribadi). Setoran vs uang tutup shift **tidak** dicocokkan otomatis sampai pencatatan setoran rutin ≥1 bulan (tanggal jual setoran tak selalu punya shift — contoh Cibinong 1 Okt). |
| F5 | EOM Closing **tidak** dipakai sebagai sumber (khusus developer/owner). |
| F6 | Keluaran **tanpa**: keterangan bebas pengeluaran (`description`), bukti/nota (`receipt_url`, `proof_url`, `stealth_photo_url`), nomor rekening. Cukup kategori. |
| F7 | Kunci CEO sudah ber-scope `finance` (keputusan owner 2026-10-08), jadi alat terpakai begitu admin-dashboard ter-deploy → **uji gerbang wajib segera setelah deploy**. |

## 3. Alat (domain `finance`)

| Alat | Argumen | Keluaran |
|---|---|---|
| `utang_po` | `jatuh_tempo_dalam_hari?` (default semua) | `total_utang`, `jumlah_po`, `lewat_jatuh_tempo` (total & jumlah), `per_supplier[]` (supplier, total, jumlah_po, jatuh_tempo_terdekat), `po[]` (nomor_po, supplier, nilai, tanggal_po, jatuh_tempo, hari_lewat, status_bayar), `komitmen` (total nilai pesan & jumlah PO belum diterima) |
| `pengeluaran_ringkasan` | `periode` (sama dengan alat penjualan: hari ini/kemarin/minggu ini/bulan ini/bulan lalu/rentang) , `outlet?` | `total`, `outlet_total`, `pusat_total`, `per_kategori[]` (kategori, label, total), `per_outlet[]` (outlet, total) |
| `setoran_ringkasan` | `periode` | `total`, `per_outlet[]` (outlet, total, jumlah), `setoran[]` (outlet, tanggal_jual, nominal, jenis), catatan "pencatatan setoran dimulai 2026-10-08" |
| `selisih_kasir` | `periode` (default kemarin) | `per_outlet[]` (outlet, shift_tutup, seharusnya, fisik, selisih), `shift_selisih[]` (tanggal, outlet, kasir, seharusnya, fisik, selisih) untuk selisih ≠ 0, `shift_belum_tutup[]` (tanggal, outlet, kasir) tidak termasuk shift yang masih berjalan hari ini |

Semua angka rupiah. Outlet tes dikecualikan (pola yang sama dengan modul lain).

## 4. Arsitektur

- `apps/admin-dashboard/src/lib/hermes/finance/` — `tipe.ts` (`KonteksFinance` berisi loader), fungsi murni penghitung per alat (diuji dengan fixture), `fixture.ts`.
- `lib/hermes/server/financeSumber.ts` — loader memakai service-role client:
  - utang: RPC `get_purchase_orders(p_from '2000-01-01', p_to hari ini)` (SECURITY DEFINER, terjangkau svc) + `purchase_order.payment_status`.
  - pengeluaran: **ekstrak isi `getExpensesAction`** (`app/actions/expenses.ts`) ke `lib/pengeluaran/ambilPengeluaran.ts(svc, filter)`; action lama memanggil fungsi itu (satu sumber dengan halaman Pengeluaran). Pembagian outlet/pusat & kategori mengikuti halaman Pengeluaran. ⚠️ Berkas yang sama disentuh tugas keamanan "Tutup server action service-role tanpa cek login" — kerjakan berurutan, jangan paralel.
  - setoran: `cash_transaction` seperti F3; tanggal jual = `sales_date`, fallback `occurred_at` (WIB) − 1 hari (aturan app Finance).
  - selisih kasir: `shifts` (status, expected/actual_ending_cash, variance, start_time) + nama staf; tanggal = `start_time` WIB.
- `lib/hermes/alat/finance.ts` → didaftarkan di `registry.ts` (`KonteksHermes.finance`), `server/konteks.ts` membangun konteksnya secara malas seperti absensi.
- `pengecualian.ts`: pola app `finance` ditambah `description|keterangan|receipt|proof_url|stealth_photo`.

## 5. SOUL CEO

Bagian baru **Finance**: sebut periode & sumber; utang = barang sudah diterima, komitmen disebut terpisah; setoran tanpa klaim "belum setor"; selisih kasir boleh menyebut nama kasir; tidak pernah menyebut bukti/nota/rekening. Daftar "App yang bisa dibaca" ditambah Finance.

## 6. Pengujian

- Unit (TDD) per fungsi penghitung: utang hanya PO diterima & belum lunas, komitmen terpisah, lewat jatuh tempo benar (WIB); pengeluaran outlet vs pusat; setoran memakai tanggal jual & fallback; selisih kasir mengecualikan shift berjalan hari ini.
- Gerbang registry: semua alat finance lolos `pengecualian.ts`; kontrol negatif (keluaran palsu memuat `description`) harus gagal.
- Paritas (SQL/layar, dicatat di `supabase/verifikasi/hermes/gerbang-finance-ceo.md`): total utang = `SUM(total_nilai_terima)` RPC `get_purchase_orders` untuk PO diterima & belum lunas (BUKAN view `po_payable_spv`, yang memakai nilai pesan); pengeluaran satu bulan = halaman Pengeluaran; setoran = riwayat Setoran; selisih kasir = laporan shift POS.
- Uji gerbang bot: 6 pertanyaan + 2 penolakan (bukti transfer, nomor rekening).

## 7. Di luar lingkup

Laba (Finance 2), kas kecil, settlement food apps, bagi hasil mitra, pencocokan setoran vs shift, cron/laporan pagi.
