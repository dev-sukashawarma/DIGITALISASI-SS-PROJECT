# Rekonsiliasi Xendit — Rencana Lanjutan

**Konteks:** fitur validasi Xendit (Task 1–7 & 9 dari `2026-11-18-validasi-xendit-histori-transaksi.md`) sudah live di `main` (ca8f7fd6b). Oktober dan 1–15 November sudah sama persis dengan Xendit. Dokumen ini mengatur sisa pekerjaannya.

**Aturan tetap:** untuk pesanan website, Xendit = kebenaran. Sebelum menambah pesanan susulan ke POS, selalu cari dulu input manual kasir (pesanan kasir / PreOrder WA, sering metode VA, bisa sehari sesudahnya).

---

## Tahap A — Pencocokan 16 November ke atas (20 Nov)

Pemicu: user mengirim Balance History terbaru (settlement sampai ≥ 19 Nov).

- [ ] A1. Unggah file lewat `/dashboard/xendit-pembayaran` (atau oleh Claude via `prosesUnggahXendit`). Unggahan ulang aman: baris kembar diabaikan berkat `xendit_id` unik.
- [ ] A2. Hitung `xendit_pembayaran` vs `orders` website (selesai) per hari, 16 Nov sampai settlement terakhir.
- [ ] A3. Setiap selisih → telusuri dengan urutan tetap:
  1. pesanan website ada tapi dibatalkan/expired → cari input manual kasir di outlet itu (nama, isi, ≤ 1 hari sesudahnya);
  2. ada input manual → tandai sebagai pesanan website (pola skrip `koreksi-order-website-manual-kasir-xendit-2026-11-18.sql`);
  3. tidak ada input manual → tanyakan ke user: dilayani (aktifkan/tambah tanpa potong stok) atau refund.
- [ ] A4. Skrip koreksi di `SS COGS SET/`, uji coba ROLLBACK dulu, jalankan setelah user setuju, asersi POS = Xendit per hari.
- [ ] A5. Perbarui memori `order-website-acuan-xendit`.

**Selesai bila:** jumlah & nominal website POS = Xendit sampai tanggal settlement terakhir.

## Tahap B — Pemetaan ID webhook (Task 0 lama)

Pemicu: pembayaran website asli pertama sesudah 18 Nov 12:05 WIB (webhook `xendit-webhook` v29, `verify_jwt=false`). Per 18 Nov malam belum ada pesanan baru.

- [ ] B1. Pastikan pembayaran itu tercatat webhook: `orders.tripay_reference` di FormOrder bukan lagi `pr-…`, dan log `function_logs` berisi payload webhook.
- [ ] B2. Ambil payload dari log (`event_message ilike '%Xendit webhook payload%'`).
- [ ] B3. Setelah settlement (H+2), cari baris CSV dengan nominal & jam sama. Catat field payload mana yang sama dengan `Transaction ID`, `Reference`, `Channel Reference`.
- [ ] B4. Kalau tak ada yang sama: uji `GET /payment_requests/{pr}` (dan endpoint payment) untuk mencari `Transaction ID`.
- [ ] B5. Tulis hasilnya di spec §5.2, commit.

**Selesai bila:** ada satu aturan pasti "field webhook X = `xendit_pembayaran.xendit_id`".

## Tahap C — Webhook menulis ke `xendit_pembayaran` (Task 8 lama)

Bergantung pada Tahap B. Repo `form order online`.

- [ ] C1. `supabase/functions/_shared/catatXenditPos.ts` — `catatPembayaranKePos(...)`, upsert ke DB POS `on_conflict=xendit_id`, `sumber='webhook'`, `cara_cocok='webhook'`. **Tidak pernah throw**: gagal ditulis ke log, status lunas di Order Online tetap jalan.
- [ ] C2. Test Deno (fetch di-mock): tanpa secret, POS 500, body upsert benar → tidak throw.
- [ ] C3. Panggil dari `xendit-webhook` (setiap event SUCCEEDED, termasuk pesanan yang sudah paid = bayar dobel) dan dari `check-xendit-status` (setelah update paid).
- [ ] C4. Secret baru di FormOrder: `POS_SUPABASE_URL`, `POS_SUPABASE_SERVICE_ROLE_KEY` — **diisi user sendiri** di dashboard Supabase, kunci tidak pernah ditempel di chat.
- [ ] C5. Deploy, uji pada pembayaran asli berikutnya: baris `cara_cocok='webhook'` muncul, lencana ✓ di Histori Transaksi tanpa unggah file.
- [ ] C6. Baris dari unggahan file sesudahnya tidak dobel (xendit_id sama) — uji dengan unggah ulang.

**Selesai bila:** pesanan website baru berlencana ✓ beberapa detik setelah dibayar; unggah file bulanan tinggal pengecek.

## Tahap D — Pemantau harian (pencegahan)

Supaya kasus "dibayar tapi expired" tidak menunggu rekonsiliasi bulanan.

- [ ] D1. Kueri pemantau `supabase/verifikasi/xendit_pembayaran/pemantau.sql`:
  - Q1 pesanan Order Online `expired` yang punya pembayaran Xendit (harus 0 sejak 18 Nov);
  - Q2 pembayaran Xendit tanpa pesanan POS selesai > 1 hari;
  - Q3 pesanan website POS dibatalkan padahal ada pembayaran Xendit;
  - Q4 cron `auto-cancel` (jobid 1) gagal / heartbeat > 5 menit.
- [ ] D2. (Opsional, keputusan owner) kirim Q1–Q3 tiap pagi ke WA developer lewat antrean GOWA yang sudah ada.

## Tahap E — Keputusan owner (bukan pekerjaan kode)

- [ ] E1. Oktober sudah closing: omzet website di sistem bergeser +Rp 111.638 (rincian di chat 18 Nov). Owner memutuskan: dibiarkan (closing tetap), atau closing Oktober direvisi.
- [ ] E2. Imbauan kasir lewat AM: pesanan website di POS cukup diproses, jangan diinput ulang lalu di-void (menunggu konfirmasi user).

---

**Urutan:** A (20 Nov) → B (begitu ada pembayaran asli) → C → D. E paralel kapan saja.
