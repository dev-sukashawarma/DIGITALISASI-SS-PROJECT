# Desain: TТД Penerimaan, Riwayat Distribusi & View Pengiriman SPV Pusat

**Tanggal:** 2026-06-11
**Status:** Disetujui
**Konteks:** Selama test E2E M2↔M3 ditemukan 3 gap: (1) histori SJ hilang setelah verifikasi, (2) tidak ada TТД serah-terima di sisi penerima, (3) tidak ada laporan penerimaan. Spec ini menutup ketiganya.

## Latar Belakang

Alur penerimaan sekarang (`VerifikasiForm`): verifikasi item per-card → summary → `handleSubmit` langsung memanggil `finalize_surat_jalan_and_ledger` → ledger tertulis, status jadi `diterima_lengkap`, redirect ke `/distribusi/terima`.

Masalah:
- `TerimaList` hanya menampilkan status `['dikirim', 'dikirim_lengkap', 'diterima_sebagian']` (`useTerimaList.ts`), sehingga SJ `diterima_lengkap` hilang dari daftar dan tak ada arsip.
- TТД hanya dikumpulkan di sisi **pengirim** (`SignatureFlow`, status `draft`, role `Kitchen SPV` + `Supir`, kolom `signatures`). Sisi penerima tidak punya langkah TТД.
- SPV Pusat (pembuat SJ) tak punya tempat memantau status penerimaan lintas-outlet.

## Keputusan Desain

| # | Keputusan | Pilihan |
|---|-----------|---------|
| 1 | Siapa TТД saat terima | Crew Penerima + Supir (2 TТД baru) |
| 2 | Penyimpanan TТД terima | Kolom baru `receipt_signatures` (JSONB) terpisah dari `signatures` |
| 3 | Kapan finalize dipanggil | Setelah verifikasi item **dan** 2 TТД lengkap (TТД = gerbang sebelum stok masuk) |
| 4 | Riwayat | Halaman terpisah `/distribusi/riwayat`, outlet sendiri saja |
| 5 | Laporan penerimaan | Domain distribusi (Riwayat = laporan); app stok cukup pakai kenaikan stok otomatis |
| 6 | View pengirim | Halaman `/distribusi/pengiriman` lintas-outlet, akses role `kepala_outlet` (SPV Pusat) |
| 7 | Mekanisme TТД+finalize | **Pendekatan 2:** RPC TТД terpisah + reuse `finalize_surat_jalan_and_ledger` (tak diubah) |

### Role mapping (`outlet_staff`)
- `kepala_outlet` ("SPV Pusat") = pembuat SJ, lihat **semua SJ lintas-outlet** (Pengiriman)
- `spv` / `crew` di outlet (mis. Budi, Andi @ EMPANG) = penerima, lihat **outlet sendiri** (Inbox + Riwayat)

## Arsitektur

### 1. Database (migration baru)

- Tambah kolom `surat_jalan.receipt_signatures JSONB NOT NULL DEFAULT '[]'::jsonb`.
- RPC baru `sign_receipt_surat_jalan(p_surat_jalan_id uuid, p_signed_by_name text, p_role text, p_signature_image text)`:
  - Pola mengikuti `sign_surat_jalan` yang sudah ada dan teruji.
  - Role valid: `'Crew Penerima'`, `'Supir'`. Tolak role lain.
  - Cegah TТД ganda per role (kalau role sudah ada di `receipt_signatures`, error).
  - Append `{signed_by, role, signed_at}` ke `receipt_signatures`, kembalikan `{ receipt_signatures: [...] }`.
  - Batas ukuran gambar mengikuti `MAX_SIGNATURE_SIZE` (50KB) seperti pola pengirim.
- `finalize_surat_jalan_and_ledger` **tidak disentuh** — test idempotency yang sudah lulus tetap valid.
- RLS/policy: pastikan `kepala_outlet` dapat `SELECT` semua `surat_jalan` (lintas-outlet); crew/spv tetap terbatas outlet sendiri (policy existing).

### 2. Alur Penerimaan (`VerifikasiForm.tsx`)

Stepper bertambah satu langkah:
```
cards (verifikasi item) → summary → signature (BARU) → finalize
```
- Step `summary`: tombol akhir diganti dari "Selesai & Simpan" menjadi **"Lanjut ke Tanda Tangan"** (pindah ke step `signature`).
- Step `signature` (baru):
  - Reuse komponen `SignatureCanvas`.
  - Kumpulkan 2 TТД: `Crew Penerima` lalu `Supir`, masing-masing via `sign_receipt_surat_jalan`.
  - Tampilkan daftar TТД yang sudah masuk + indikator role yang masih kurang (pola seperti `SignatureFlow`).
  - Tombol **"Selesai & Simpan Penerimaan"** disabled sampai kedua role TТД lengkap.
- Saat "Selesai & Simpan Penerimaan":
  - Jalankan update item (qty_terima, kondisi, catatan, verified_at) — seperti `handleSubmit` sekarang.
  - Panggil `finalize_surat_jalan_and_ledger` (existing) → stok masuk.
  - Redirect ke `/distribusi/riwayat`.
- **Idempotency / recovery:** jika finalize gagal setelah TТД tersimpan, status belum final → halaman tetap mengizinkan klik "Selesai & Simpan Penerimaan" lagi (finalize idempoten). TТД tidak hilang karena sudah tersimpan di DB.

### 3. Halaman Riwayat (`/distribusi/riwayat`)

- Route baru di route group yang dilindungi `AuthGuard`.
- Hook (mis. `useRiwayatList`) mengambil SJ status `['diterima_lengkap', 'diterima_sebagian']`, difilter `outlet_id = outletStaff.outlet_id`.
- List tiap baris: asal outlet, tanggal terima, jumlah item, badge "Ada Masalah" jika ada item `kondisi = rusak` atau `qty_terima < qty_dikirim`.
- Klik baris → halaman detail (boleh reuse/extend `SuratJalanDetail` atau halaman detail terima) menampilkan:
  - Item: qty_terima vs qty_dikirim, kondisi, catatan.
  - **Semua TТД**: `signatures` (Kitchen SPV + Supir) dan `receipt_signatures` (Crew Penerima + Supir).
- `TerimaList` tetap murni "inbox" (status `dikirim*`) — tidak diubah perilaku filternya.

### 4. View Pengiriman (`/distribusi/pengiriman`)

- Route baru, akses **hanya `kepala_outlet`**. Halaman cek role; non-`kepala_outlet` di-redirect/ditolak.
- Hook (mis. `usePengirimanList`) mengambil **semua SJ lintas-outlet** (tanpa filter outlet), status apa pun (`draft`/`dikirim`/`diterima_*`).
- Kolom: outlet tujuan, tanggal kirim, status terima, indikator masalah (item rusak/kurang).
- Klik → detail sama seperti Riwayat.

### 5. Navigasi & Akses (dashboard distribusi)

Dashboard menampilkan menu sesuai `outletStaff.role`:
- `crew` / `spv`: **Inbox Penerimaan** + **Riwayat**
- `kepala_outlet`: **Buat Surat Jalan** + **Pengiriman** (lintas-outlet)

Proteksi: `AuthGuard` existing + cek role di halaman Pengiriman.

## Penanganan Error
- TТД gagal disimpan → alert, TТД tidak ditambahkan, user bisa ulang.
- TТД ganda per role → ditolak di RPC, UI disable opsi role yang sudah TТД.
- finalize gagal → status belum final, tombol tetap bisa diklik ulang (idempoten).
- Gambar TТД > 50KB → ditolak sebelum kirim (pola existing).

## Testing
- **Unit/RPC:** `sign_receipt_surat_jalan` — append benar, tolak role invalid, tolak TТД ganda.
- **E2E (lanjutan FASE B):**
  1. Crew login → Inbox tampil SJ outletnya.
  2. Verifikasi item → step TТД → isi Crew Penerima + Supir → Selesai.
  3. Cek ledger & monitoring stok naik (rantai M3→M2→Monitoring).
  4. SJ pindah dari Inbox ke Riwayat; detail menampilkan 4 TТД.
  5. SPV Pusat login → Pengiriman menampilkan SJ tsb berstatus diterima.
- **Idempotency:** ulang "Selesai" setelah finalize sukses tidak menggandakan ledger.
- **RLS:** crew outlet lain tidak melihat SJ ini; `kepala_outlet` melihat semua.

## Di Luar Scope
- Tidak ada panel laporan penerimaan di app stok (SPVDashboard) — laporan = domain distribusi.
- Tidak mengubah alur/TТД sisi pengirim yang sudah jalan.
- Tidak mengubah `finalize_surat_jalan_and_ledger`.
