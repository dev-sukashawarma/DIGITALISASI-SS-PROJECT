# SUKA Bot — Asisten AI Owner/Admin (Tahap 1)

**Tanggal:** 2026-10-03
**Status:** Tahap 1 diimplementasi di branch `feat/suka-bot` (lihat plan). DB live 2026-10-05; uji browser & pencocokan angka belum.
**Pemakai:** role `admin`, `owner`, `developer` saja — seluruh proyek, semua tahap.

## 1. Tujuan

Asisten AI yang (a) menyajikan **rekap harian** penjualan kemarin saat owner/admin
membuka portal, dan (b) bisa **ditanya** soal data bisnis lewat chat.

Tujuan akhirnya: **bisa membaca seluruh app suite**. Dicapai bertahap, domain demi
domain (§9). Tahap 1 = penjualan + stok bahan per outlet.

Bukan tujuan: mengirim pesan WhatsApp/Telegram/messaging lain; melakukan aksi apa pun
(SUKA Bot hanya membaca).

## 2. Keputusan inti

| # | Topik | Keputusan |
|---|---|---|
| K1 | Kanal | Web. **Tidak** menyentuh WhatsApp/WAHA atau messaging lain. |
| K2 | Lokasi tampilan | Avatar melayang di **portal launcher** + halaman penuh `/asisten` di portal. |
| K3 | Akses | `admin`, `owner`, `developer` = persis `is_owner_or_admin()` yang sudah ada. |
| K4 | Cara menjawab | AI **hanya memanggil alat** yang kita sediakan. Tidak menulis SQL, tidak menghitung angka sendiri. |
| K5 | Model | Lewat **9Router** (sudah jalan). Satu model tetap di atas API key berbayar; fallback antar-model & RTK/penghemat token **dimatikan**. |
| K6 | Rekap | Dibuat saat pertama dibuka setelah 05:00 WIB, disimpan sebagai potret. |
| K7 | Riwayat | Per akun, 90 hari, RLS `user_id = auth.uid()`. |
| K8 | Omzet acuan | **Omzet kotor** (Gross Revenue Rangkuman Penjualan). |
| K9 | Arsitektur | Tampilan di portal, **otak di admin-dashboard** (`/api/asisten`). |
| K10 | Persona | **SUKA Bot**, santai, memanggil "Bos". Avatar 3D bergambar dulu, interaktif nanti. |

## 3. Arsitektur

```
portal (launcher + /asisten)          admin-dashboard
  └─ <SukaBotWidget/> (lazy, hanya    ─fetch(credentials:include)─>  POST /api/asisten/chat
     dirender untuk 3 role)                                          GET  /api/asisten/rekap
                                                                       │
                                                                       ├─ cek is_owner_or_admin() (sesi penanya)
                                                                       ├─ panggil 9Router (OpenAI-compatible)
                                                                       └─ jalankan alat → lib/posReport (load+compute, cache per hari)
                                                                                        → stok_balance + formatter satuan
```

- **Kenapa otak di admin-dashboard:** rumus Rangkuman Penjualan
  (`lib/posReport/compute.ts`, `load.ts`) dan cache per-hari tahan redeploy
  (volume `admin-next-fetch-cache`) ada di sana. Menyalin ke portal = salinan rumus
  omzet ketiga, tanpa cache. SUKA Bot dijamin sama dengan dashboard karena **memanggil
  kode yang sama**.
- **Sesi:** cookie SSO `.sukashawarma.com` ikut terkirim. Alat dijalankan dengan
  **sesi penanya**, bukan service role (hindari pola "Server Action + service role
  tanpa cek role", Session 2026-07-20). Setiap endpoint memanggil
  `is_owner_or_admin()` di server; guard UI hanya kosmetik.
- **CORS:** `/api/asisten/*` hanya menerima origin portal produksi (+ localhost dev).
- **Middleware admin-dashboard dilewati untuk `/api/asisten/*`:** role `owner` tidak
  punya `admin-dashboard` di `ROLE_APP_ACCESS`, sehingga `enforceAppAccess` akan
  me-redirect owner (dan preflight CORS). Route memeriksa sesi + `is_owner_or_admin()`
  sendiri — itu satu-satunya gerbang.
- **Isolasi portal:** widget dimuat terpisah (dynamic import) dan dibungkus error
  boundary sendiri. Portal adalah pintu login semua role — kegagalan SUKA Bot tidak
  boleh merusak launcher. Bila admin-dashboard down/redeploy, panel menampilkan
  "SUKA Bot sedang tidak tersedia".
- **Env (admin-dashboard, server-only):** `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`.
  Wajib di-`ARG`+`ENV` di **stage runner** Dockerfile dan di panel Coolify (gotcha #1
  CLAUDE.md). Mengganti 9Router ↔ penyedia lain cukup ganti env.

## 4. Alat tahap 1

Semua hanya-baca. Parameter divalidasi di server (zod); AI tidak pernah menyusun query.

| # | Alat | Sumber | Keluaran |
|---|---|---|---|
| T1 | `omzet` (periode × outlet × kanal) | `lib/posReport` | omzet kotor, omzet bersih (bila diminta), jumlah transaksi |
| T2 | `bandingkan_periode` | T1 dipanggil dua kali | dua angka + selisih + % |
| T3 | `menu_terlaris` (teratas/terbawah) | `lib/posReport` item breakdown | nama menu, qty, omzet |
| T4 | `ranking_outlet` | `lib/posReport` | semua outlet terurut omzet kotor + perubahan |
| T5 | `stok_bahan` (satu bahan, satu/semua outlet) | `stok_balance` + `saldo_is_gram` | saldo terformat + tanggal opname terakhir |

### Aturan T5 (stok)
- Format satuan **identik dengan app Stok** (`formatTriUnitSaldoAdaptive`).
  `apps/stok/src/lib/format/compositeUnit.ts` dan salinan admin-dashboard berbeda
  **hanya di komentar** (kodenya identik, dicek 2026-10-03). Test penjaga paritas
  dipasang; bila suatu hari beda, versi stok = acuan.
- Sumber: `monitoring_view_spv` (`current_qty`, `saldo_is_gram`, `last_opname_date`).
  Gudang Pusat ikut sebagai lokasi yang bisa ditanya.
- Wajib menyebut **opname terakhir** outlet itu; > 3 hari → tandai "mungkin tidak akurat".
- Nama bahan dicari dari teks; **lebih dari satu kecocokan → tanya balik**, jangan
  menebak (kasus nyata: SAUS CABE vs SAOS CABE). Hanya bahan `is_active`.
- Tanpa nilai rupiah persediaan.

### Lingkup outlet (T1–T4, rekap)
- **Daftar boleh:** outlet `is_active = true` dengan `type IN ('outlet','mitra')`.
  Tipe lain (`test`, `internal`, `office`, `gudang`, `marketplace`, `system`, dan tipe
  baru apa pun) otomatis tidak ikut. Per 2026-10-03: 10 milik + 11 mitra = 21.
- Satu ranking, **tanpa label milik/mitra**.
- SS Online (Shopee/TikTok Shop) tidak ikut ranking.
- Pertanyaan periode lampau tetap menghitung outlet yang kini nonaktif bila saat itu
  masih berjualan.

## 5. Rekap harian

**Isi** (tentang **kemarin**, 00:00–23:59 WIB):
1. Omzet kotor kemarin vs **hari yang sama minggu lalu**.
2. **Ranking semua outlet** + perubahan masing-masing vs minggu lalu.
3. Jumlah transaksi.
4. 3 menu terlaris kemarin.

Tidak memuat: per kanal, rata-rata per struk, HPP/laba, waste, status operasional.

**Siklus hidup:**
- Dibuat oleh pembuka pertama setelah **05:00 WIB** (tanpa cron). Sebelum 05:00 yang
  tampil rekap hari sebelumnya, berlabel jelas.
- Disimpan sebagai **potret** dengan jam pembuatan ("Dibuat 06:12 WIB"); tidak berubah
  diam-diam saat order terlambat tersinkron.
- Tombol **"Perbarui rekap"** membuat versi baru; versi lama tetap tersimpan.
- Dibuat sekali, dibaca semua akun.
- Angka **dan teks** rekap disusun kode (template), tanpa AI — nol risiko halusinasi,
  nol biaya token. AI dipakai untuk tanya jawab saja. (Diputuskan saat menyusun plan.)
- Avatar diberi titik merah saat rekap baru belum dibuka **di perangkat itu**
  (localStorage).

## 6. Definisi waktu

| Kata | Arti (WIB) |
|---|---|
| hari ini | 00:00 s/d sekarang — angka berjalan, ditulis "sampai pukul HH:MM" |
| kemarin | 00:00–23:59 kemarin |
| minggu ini / lalu | **Senin** s/d hari ini / Senin–Minggu sebelumnya |
| bulan ini / lalu | tgl 1 s/d hari ini / satu bulan kalender penuh |

Perbandingan periode berjalan memakai **rentang sama panjang** (Sen–Kam vs Sen–Kam).
Setiap jawaban menuliskan **tanggal persis** kedua periode.

## 7. Perilaku & persona

- Nama **SUKA Bot**; Bahasa Indonesia santai, memanggil "Bos".
- **Angka dulu, baru cerita.** Setiap jawaban menyebut periode + sumber
  ("sumber: Rangkuman Penjualan").
- Dilarang: menebak angka yang tidak dikembalikan alat; menyimpulkan penyebab di luar
  data (dugaan boleh, wajib disebut dugaan); mengaku melakukan aksi.
- Pertanyaan di luar alat: jawab jujur "belum bisa", tunjukkan halaman app yang
  relevan, catat ke log pertanyaan gagal.
- Avatar: gambar bergaya 3D (pre-render) dengan pose **diam / berpikir / rekap siap /
  bingung** + animasi ringan. Aset dibuat tim owner; placeholder sampai siap.
  3D interaktif = tahap lanjut, tidak memblokir tahap 1.

## 8. Data (tabel baru, admin-dashboard memakai sesi penanya)

| Tabel | Isi | Akses |
|---|---|---|
| `suka_bot_rekap` | tanggal, versi, angka mentah (jsonb), teks, `dibuat_oleh`, `dibuat_at` | baca & buat: `is_owner_or_admin()` |
| `suka_bot_percakapan` / `_pesan` | riwayat chat | `user_id = auth.uid()` saja; hapus otomatis > 90 hari |
| `suka_bot_gagal` | teks pertanyaan, tanggal, alasan (tanpa sisa percakapan) | baca: `developer` |
| `suka_bot_pemakaian` | per akun per hari: jumlah pertanyaan, token | baca: `developer`; dipakai untuk batas harian |

Semua tabel: `REVOKE ALL FROM anon`; view apa pun wajib `security_invoker = true`.

## 9. Peta jalan domain

| Tahap | Domain |
|---|---|
| **1** | **Penjualan (T1–T4) + stok bahan per outlet (T5)** |
| 2 | Distribusi & opname |
| 3 | Pembelian & utang supplier |
| 4 | Operasional harian (absensi, pesanan aplikasi) |
| 5 | Keuangan (laba, OPEX, bagi hasil mitra) |
| 6 | HR sensitif (gaji, kasbon) — aturan akses diputuskan tersendiri; kemungkinan lebih sempit dari 3 role |

Setiap tahap baru dirilis setelah jawabannya **dicocokkan dengan halaman app aslinya**.

## 10. Masih terbuka (dijawab saat implementasi)

1. Model persis di 9Router, dan apakah container admin-dashboard bisa menjangkau
   9Router (default `localhost:20128`; endpoint tidak boleh terbuka ke internet tanpa key).
2. Batas harian per akun (usulan 100 pertanyaan) dan batas kredit bulanan.
3. Aturan akses tahap 6.

## 11. Verifikasi sebelum rilis tahap 1

- Untuk 3 rentang (kemarin, minggu ini, bulan lalu): angka T1/T4 = Rangkuman Penjualan
  untuk filter yang sama, sampai rupiah.
- T5 untuk 5 bahan × 3 outlet (termasuk satu baris `saldo_is_gram`) = tampilan app Stok.
- Role di luar 3 role: `/api/asisten/*` balas 403; widget tidak dirender.
- Portal tetap login normal saat admin-dashboard dimatikan.
- Rekap: dua akun membuka bersamaan → tetap satu rekap (kunci unik tanggal+versi).
