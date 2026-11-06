# Hub Approval Finance — Desain

**Tanggal:** 2026-11-06
**App:** `apps/finance` (+ satu tautan di `apps/admin-dashboard`)
**Status:** desain, belum dibangun

## 1. Maksud & alasan

Pengajuan yang menunggu keputusan admin finance sekarang tersebar di empat halaman
(Pencairan Petty Cash, Approval PO, Pembayaran Vendor, Pengajuan Dana Kantor). Badge
menu hanya menghitung petty cash dan Approval PO, sehingga pembayaran vendor (alur
baru, 6 Nov) dan voucher dana kantor tidak terlihat kecuali halamannya dibuka satu
per satu.

Owner ingin **satu tempat khusus untuk approval**: admin finance membuka satu halaman,
melihat semua yang menunggu dirinya, dan memutuskannya langsung di sana.

## 2. Keputusan owner (6 Nov 2026)

1. Hub bisa **langsung menyetujui/menolak**, bukan sekadar daftar tautan.
2. Susunan **A**: satu kotak masuk campur semua jenis, **yang paling lama menunggu di
   atas**, dengan saringan per jenis (chip berangka).
3. **Gaji tidak ikut** — tetap di halaman Pencairan Gaji.
4. Hub jadi **satu-satunya tempat memutuskan**: tombol setuju/tolak di halaman lama
   dicabut.
5. Tebakan berikut diterima tanpa koreksi:
   - Setujui tetap membuka jendela yang sama dengan sekarang (pilih rekening, unggah
     bukti, cek saldo) — aturan uang tidak berubah.
   - Tolak wajib alasan.
   - Satu angka total di menu sidebar.
6. Langkah kedua petty cash, **"Serahkan ke AM"**, **ikut masuk hub** sebagai pekerjaan
   yang menunggu (jawaban owner atas pemeriksaan builder).

## 3. Cakupan

### Masuk hub (empat jenis keputusan + satu langkah serah terima)

| Jenis | Baris menunggu = | Tombol | Aksi (sudah ada, dipakai ulang) |
|---|---|---|---|
| Pencairan petty cash | `petty_cash_topups.status = 'forwarded_to_finance'` | Setujui / Tolak | `FinanceApprovalModal` + mutasi `review_petty_cash_topup` (lihat `FinancePettyCashList.tsx` `handleApprove`/`handleReject`) |
| Approval PO | `purchase_order.status = 'menunggu_approval_finance'` | Setujui / Tolak | RPC `approve_po_finance` / `reject_po_finance` (`usePoApproval.ts`) |
| Pembayaran vendor | `purchase_order.payment_status = 'pending'` | Setujui / Tolak | `SetujuiModal` + RPC `setujui_bayar_po` / `tolak_bayar_po` (`SupplierView.tsx`, `useSupplierSettlement.ts`) |
| Verifikasi dana kantor | voucher berstatus `waiting_verification` (lihat §6) | Verifikasi / Tolak | `VerifyVoucherModal` + `verifyVoucher`/`rejectVoucher` (`useOfficeVouchers.ts`) |
| Serahkan petty cash ke AM | `petty_cash_topups.status = 'approved_by_finance'` | **Serahkan ke AM** (tanpa Tolak) | `forwardPettyCashFinance` (`app/actions/pettyCash.ts`, dipanggil dari `usePettyCash.ts`) |

Baris "Serahkan ke AM" ikut dihitung di badge dan punya chip saringan sendiri. Setelah
admin finance menyetujui sebuah petty cash di hub, baris itu berganti menjadi baris
"Serahkan ke AM" (tidak hilang dari hub). Sebagai pekerjaan, ia berbeda dari keputusan:
tidak ada Tolak, cukup konfirmasi singkat.

### Tidak masuk

- Gaji (keputusan owner).
- Langkah leader / area manager / crew di alur petty cash (bukan keputusan admin finance).
- Persetujuan di app lain: batal order POS, bypass absensi, opname, waste, permintaan bahan.
- Permintaan pembelian (PR) — badge-nya milik purchasing, tidak berubah.

## 4. Halaman hub

- **Rute:** `/approval`. **Menu:** "Hub Approval", item pertama grup "Kas" di
  `CashLayout.tsx`, dengan badge = total keempat jenis.
- **Siapa:** admin_finance, admin, owner, developer (`isChecker`). **Purchasing tidak
  mendapat hub** (keputusan Claude, lihat §9): menu tidak muncul di sidebar purchasing,
  dan penjaga rute `CashLayout` tetap mengalihkan purchasing dari `/approval`.
  Penjaga sebenarnya tetap di RPC/server action yang sudah ada — hub tidak menambah
  jalur tulis baru.
- **Galat per sumber:** bila satu sumber gagal dibaca (mis. developer tidak lolos
  `PERAN_KEUANGAN` di voucher dana kantor), sumber itu menampilkan pesan galat di
  chip/daftarnya dan sumber lain tetap tampil. Jangan diam-diam menampilkan 0.
- **Atas:** chip saringan `Semua N · Petty cash N · Serahkan ke AM N · Approval PO N ·
  Bayar vendor N · Dana kantor N`. Ringkasan total nominal menunggu boleh ada (pilihan builder).
- **Baris:** label jenis berwarna · nama outlet/vendor/divisi · keterangan singkat
  (pengaju, nomor dokumen) · nominal · umur menunggu · tombol.
  - Urutan: paling lama menunggu di atas, lintas jenis.
  - Umur yang lama ditandai merah. Ambang: **> 24 jam** (pilihan builder, jadikan
    konstanta bernama).
  - Waktu "mulai menunggu" per jenis: pakai kolom paling dekat dengan saat pengajuan
    masuk ke finance; bila tak ada, `updated_at`/`created_at`. Builder menentukan per
    jenis dan menuliskannya di kode.
- **Setujui** → jendela milik jenis itu (dipakai ulang, bukan ditulis ulang). Jendela
  yang sekarang ditulis inline di halaman (mis. `SetujuiModal` di `SupplierView.tsx`)
  dipindah ke komponen sendiri agar bisa dipakai hub.
- **Tolak** → alasan wajib, lewat jendela kecil yang konsisten untuk keempat jenis
  (ganti `window.prompt` di bayar vendor). Petty cash & voucher memakai mekanisme tolak
  yang sudah ada; bila salah satunya kini tidak menyimpan alasan, alasan tetap diminta
  di layar dan dikirim lewat kolom catatan yang ada — **tanpa migration baru**.
- **Detail:** tiap baris punya tautan ke dokumennya (detail PO, bukti, dll) untuk dilihat
  sebelum memutuskan.
- **Kosong:** pesan "Tidak ada pengajuan yang menunggu".
- **Segar:** ikut realtime/invalidation yang sudah dipakai halaman asal
  (`useFinanceRealtime`), sehingga keputusan dari tab lain hilang dari daftar.

## 5. Halaman lama

| Halaman | Perubahan |
|---|---|
| `/petty-cash` | Tombol "Proses / Acc" **dan** "Serahkan AM" dicabut, diganti tautan "Putuskan di Hub Approval". Tab, riwayat, bukti tetap. |
| `/po-approval` | Tombol setuju/tolak dicabut. Daftar tetap sebagai status — ini tetap halaman status bagi purchasing; tautan "ke Hub" hanya tampil untuk role yang punya hub. |
| `/supplier` (Pembayaran Vendor) | Tab "Menunggu approval" tetap menampilkan daftar, tanpa tombol Setujui/Tolak; tombol **Ajukan** (purchasing) tidak berubah. |
| `/pengeluaran/kantor` | Tombol verifikasi/tolak dicabut, diganti tautan ke hub. Membuat voucher & mengunggah nota tetap di sini. |

Badge `/petty-cash` dan `/po-approval` di sidebar dipindah ke "Hub Approval".

`apps/admin-dashboard` `pos-admin/petty-cash/PettyCashView.tsx`: ketiga tombol keputusan
dicabut — **Tolak** (menolak `forwarded_to_finance` lewat `finance_process_petty_cash`
tanpa alasan) dan **Serahkan ke AM** (`forwardFinanceFunds`) — dan "Cairkan di Finance"
diganti satu tautan "Putuskan di Hub Approval" ke `${financeUrl}/approval`. Daftar
tetap tampil sebagai status. Server action `processFinancePettyCash`/`forwardFinanceFunds`
di admin-dashboard yang jadi tak terpakai boleh dihapus.

## 6. Batasan

- Nol migration, nol RPC baru, nol perubahan aturan uang. Semua tulis tetap lewat
  RPC/server action yang ada beserta penjaganya (rekening sumber, bukti wajib, cek saldo).
- Voucher dana kantor menyimpan status di teks `expenses.description` (penanda
  `[OFFICE_VCR]`) dan kolom `type`; baca lewat `getOfficeVouchersAction` /
  `deserializeVoucherFromRow` yang sudah ada, jangan parsing ulang.
- Hub membaca setiap sumber dengan kueri yang sudah ada bila memungkinkan; jangan
  menambah select mentah tanpa batas (cap 1.000 baris PostgREST).
- Perubahan hanya di `apps/finance` + halaman petty cash `apps/admin-dashboard` (§5).
  ⚠️ Perlu redeploy kedua app.

## 7. Diserahkan ke builder

- Bentuk tipe gabungan baris hub & cara menyatukan empat sumber (hook per sumber lalu
  digabung di klien sudah cukup).
- Teks, ikon, warna label per jenis (ikuti gaya `CashLayout`/`ui.tsx`).
- Tata letak layar HP (baris boleh bertumpuk).
- Ambang "lama" (usul 24 jam) dan kolom waktu-menunggu per jenis.

## 8. Selesai bila

- Admin finance membuka `/approval`, melihat keempat jenis yang menunggu, menyetujui dan
  menolak masing-masing, dan hasilnya sama persis dengan memutuskan dari halaman lama
  hari ini (saldo, status, bukti, riwayat).
- Petty cash yang baru disetujui muncul sebagai baris "Serahkan ke AM" dan bisa
  diserahkan dari hub.
- Halaman lama (finance & admin-dashboard) tidak lagi punya tombol memutuskan atau
  menyerahkan.
- Purchasing tidak melihat menu hub dan `/po-approval` tetap berfungsi sebagai status.
- Badge "Hub Approval" = jumlah yang tampil di hub.
- Type-check & build `finance` dan `admin-dashboard` lolos; uji di browser dengan akun
  admin finance.

## 9. Keputusan Claude (bukan dari owner — cek saat membaca)

1. **Tombol Tolak & Serahkan ke AM di admin-dashboard dicabut**, mengikuti keputusan owner
   "hub satu-satunya tempat" (pemeriksaan builder menemukan Tolak tanpa alasan di sana).
2. **Purchasing tidak mendapat hub.** Membukanya berarti purchasing melihat petty cash &
   dana kantor yang kini tertutup bagi mereka, dan sebagian sumber akan galat.
   `/po-approval` tetap jadi halaman status mereka.
3. **Developer tidak ditambahkan ke `PERAN_KEUANGAN`**; sumber dana kantor menampilkan
   galat per sumber untuk developer.
4. Ambang umur "lama" = 24 jam; tolak di keempat jenis lewat satu jendela alasan yang
   sama; tanpa migration.
