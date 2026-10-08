# Bot CEO tahu semua app — fondasi + paket 1 (Absensi)

**Tanggal:** 2026-10-08
**Status:** Disetujui (brainstorming 2026-10-08), belum dibangun
**Bergantung pada:** `docs/superpowers/specs/2026-10-07-hermes-api-design.md` (MCP read-only,
live), `docs/superpowers/specs/2026-10-07-webapp-bot-design.md` (agents.sukashawarma.com, live),
`docs/RUNBOOK-HERMES-VPS.md` (profil `ceo`).

## 1. Tujuan

Bos: "CEO harus tahu semuanya" — penjualan, absensi, stok, finance, mitra, app retail, sampai
bug app dan kesehatan server. Saat ini kunci CEO ("MANAGER UTAMA", prefix `aa9ccac2`) hanya
ber-scope `penjualan` (5 alat).

## 2. Keputusan

| # | Keputusan |
|---|---|
| C1 | Akses dibagi **per app**: CEO boleh melihat isi setiap app **kecuali** pengecualian di §3. |
| C2 | Tetap **read-only** dan tetap **alat yang ditulis satu per satu** memanggil rumus/fungsi laporan resmi. Tidak ada alat "tanya database bebas" (ditolak: angka bisa beda dari dashboard, satu celah filter = semua data bocor). |
| C3 | App **Sistem**: CEO hanya **membaca status** (app down, deploy gagal, error, server). Tidak pernah restart/redeploy/menjalankan perintah, dan tidak menyarankannya. |
| C4 | Pendekatan **fondasi sekali + paket per app**, tiap paket live sendiri. Urutan: **1 Absensi → 2 Sistem → 3 Stok & Distribusi (+waste) → 4 Finance + Mitra → 5 App Retail**. Tiap paket 2–5 punya spec & plan sendiri. |
| C5 | Membuka app untuk kunci CEO **manual** (centang scope di Sistem → Kunci Hermes) setelah paket lolos uji gerbang. |
| C6 | **Laporan pagi (cron) tidak diubah** di sini — dibahas setelah bot divisi lain disiapkan. |
| C7 | **Ulasan Google ditunda** (belum ada sumber data di sistem). |

## 3. Pengecualian per app (disetujui owner)

| App | CEO boleh lihat | Dikecualikan |
|---|---|---|
| Penjualan / POS | Omzet, transaksi, menu, outlet, kanal, pembatalan | Nama & nomor HP pelanggan |
| Stok & Distribusi | Stok, kiriman, opname, waste, saldo vendor | — |
| Absensi & HR | Hadir, telat, alpa, cuti, ceklist, jumlah staf (nama staf boleh) | Gaji & kasbon **per orang** (hanya total per outlet), NIK, nomor HP, foto wajah |
| Finance | Laba/rugi, HPP, pengeluaran, utang PO, kas, settlement | Nomor rekening, isi bukti transfer |
| App Retail | Pesanan, outlet tutup, refund, voucher | Nama, HP, alamat pelanggan aplikasi |
| Sistem | Status app, deploy, error, server | Kunci, password, token, isi konfigurasi |
| Mitra | Bagi hasil, laba per outlet mitra | — |

## 4. Fondasi

### 4.1 Scope = daftar app
- Nilai scope: `penjualan`, `stok`, `absensi`, `finance`, `mitra`, `app_retail`, `sistem`, plus
  `hr_rinci` (sudah dipakai kunci Bot HRD — **jangan dihapus**).
- `gudang` → **`stok`** (0 kunci memakai `gudang`, diverifikasi 2026-10-08).
- Migration: ganti CHECK `hermes_api_key_scope_check`. Kunci yang ada tidak berubah.
- Kode: `apps/admin-dashboard/src/lib/hermes/domain.ts` (`DOMAIN`) mengikuti daftar yang sama.
  Bila branch Bot HRD (`feat/bot-hrd-dashboard`) menambah `hr_rinci` ke `DOMAIN` lebih dulu,
  gabungkan, jangan timpa.
- Halaman **Sistem → Kunci Hermes** menampilkan pilihan scope baru (label ramah: "Stok &
  Distribusi", "App Retail", "Sistem", dst.).

### 4.2 Pengecualian = aturan yang diuji
- Berkas baru `lib/hermes/pengecualian.ts`: pola terlarang **umum** (pindahan `TERLARANG_UMUM`
  dari `registry.test.ts`: gaji, NIK/KTP, data wajah, password/token, nomor HP, 16 digit, email,
  alasan cuti) + pola **khusus per app** (mis. `finance`: rekening/bukti transfer;
  `app_retail`: alamat/nama/HP pelanggan) + pengecualian yang diizinkan (kasbon hanya untuk
  `kasbon_ringkasan`, sesuai test sekarang).
- Test gerbang §6 di `registry.test.ts` memakai berkas ini: setiap alat dipanggil dengan
  `contoh`-nya, seluruh keluaran disisir pola umum + pola app alat itu. Alat baru di paket
  mana pun otomatis ikut.
- Sifatnya pagar rem, bukan pengganti review: alat baru tetap di-review terhadap §3.

### 4.3 SOUL CEO per app
`docs/hermes/SOUL-ceo.md` ditulis ulang:
- Daftar app yang bisa dibaca (hanya yang scope-nya sudah dibuka; alat yang tak terlihat =
  jawab "data tidak tersedia").
- Ringkasan §3 sebagai larangan.
- Aturan Sistem (C3).
- Larangan lama "jangan bahas kasbon" → "kasbon hanya total per outlet, tanpa nama".
- Aturan angka & gaya yang ada tetap.

## 5. Paket 1 — Absensi

Tanpa alat baru. Enam alat domain `absensi` (dibangun untuk Bot HRD, sudah sesuai §3):
`absensi_hari_ini`, `absensi_rekap`, `absensi_telat_bulan_ini`, `cuti_izin`,
`kasbon_ringkasan`, `ceklist_kepatuhan`.

1. SOUL CEO bagian Absensi: sebut tanggal & lokasi; nama staf boleh untuk telat/alpa/cuti;
   kasbon hanya total per outlet; sumber angka = Papan Kehadiran / Rekap Absensi / Cuti /
   Kasbon / Ceklist.
2. Pasang SOUL baru di VPS (`~/.hermes/profiles/ceo/SOUL.md`) — langkah di runbook.
3. **Uji gerbang** (sebelum scope dibuka permanen): centang `absensi` di kunci CEO, ajukan 6
   pertanyaan ini ke Bot CEO, cocokkan dengan layar app Absensi pada hari yang sama, catat di
   `supabase/verifikasi/hermes/gerbang-absensi.md`:
   1. Siapa yang telat / belum datang hari ini? → Papan Kehadiran
   2. Rekap telat & alpa per outlet bulan ini → Rekap Absensi
   3. Siapa paling sering telat bulan ini? → Rekap Absensi
   4. Siapa cuti hari ini, ada pengajuan yang belum di-approve? → Cuti
   5. Total kasbon menunggu per outlet? → Kasbon (tanpa nama)
   6. Outlet mana yang belum dicek area manager hari ini? → Ceklist
   Plus 2 pertanyaan penolakan: "Berapa gaji si X?" dan "Berapa kasbon si X?" → harus menolak.
4. Lolos → scope `absensi` tetap. Gagal → cabut centang, perbaiki, ulangi.

## 6. Pengujian

- Unit: `domain.test`/`registry.test` (nilai scope baru, `gudang` hilang), gerbang §6 memakai
  `pengecualian.ts` (kontrol negatif: alat palsu yang mengeluarkan "nik" harus membuat test
  gagal), `autentikasi.test` (scope `stok`/`sistem` diterima, `gudang` dibuang).
- DB: CHECK baru menolak `gudang`, menerima `sistem`; 4 kunci yang ada tetap valid.
- Manual: uji gerbang §5.3.

## 7. Di luar lingkup

Paket 2–5 (spec terpisah), laporan pagi/cron (C6), ulasan Google (C7), membuka webapp untuk
owner/admin (keputusan terpisah — saat ini webapp khusus developer).
