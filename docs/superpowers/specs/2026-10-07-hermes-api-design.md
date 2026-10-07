# Hermes API — Bot Divisi Suka Shawarma

**Tanggal:** 2026-10-07
**Status:** Disetujui (grilling 2026-10-07), belum dibangun
**Pemilik sisi Hermes:** dev (Hermes Agent, Nous Research — belum di-install)

## 1. Latar

Bos meminta bot per divisi: CEO (tahu semua, data harian), Sosmed, Finance, Admin WA,
HRD, Ahli Review Google, Gudang — "intinya yang ada di web app dibuat botnya", dipakai
semua divisi.

Bot dijalankan **Hermes Agent** di **VPS Hostinger terpisah** (IPv4 statis), dibungkus
jadi webapp khusus bos. Repo ini hanya menyediakan **API baca** agar Hermes bisa
mengambil data webapp.

Riwayat yang membentuk desain ini:
- `hermes_api_inject` (settlement TikTok) dihentikan 14 Sep 2026 — menulis data kembar
  → omzet mitra membengkak. **Pelajaran: jangan beri sistem luar jalur tulis.**
- `VALIDATION_API_KEY` = satu kunci untuk semua, sempat ter-commit ke repo publik.
  **Pelajaran: kunci per pemakai, bisa dicabut, tak pernah di kode.**

## 2. Batas lingkup

**Di dalam (repo ini):** server MCP baca-saja di admin-dashboard, manajemen kunci,
log panggilan, verifikasi login SSO, teks digest siap kirim.

**Di luar (sisi Hermes / pihak lain):**
- Auto posting & auto komen sosmed → proyek teman (sudah ada).
- Analitik sosmed, review Google, Admin WA pelanggan → Hermes menyambung langsung ke
  platformnya. Admin WA butuh WhatsApp Business API resmi (keputusan & biaya terpisah).
- Webapp Hermes, jadwal, Master Bot Telegram → dikerjakan pemilik Hermes.
- **SUKA Bot (portal) tidak disentuh** — proyek terpisah.

## 3. Keputusan

| # | Keputusan |
|---|---|
| K1 | Hermes **read-only**. Nol endpoint tulis ke Supabase. |
| K2 | SUKA Bot & Hermes terpisah; yang dibagi hanya **kode perhitungan**, bukan AI. |
| K3 | API di **admin-dashboard**, **wajib** memanggil fungsi laporan yang dipakai layar (`getPosReport`, RPC owner summary, `monitoring_view_spv`, dst). Dilarang query tabel mentah. |
| K4 | **Kunci per bot + scope + allowlist IP**. Disimpan sebagai hash, dicabut per kunci, setiap panggilan dicatat. Dibuat dari halaman admin, ditampilkan sekali. |
| K5 | API disusun per **domain**. Bot = kumpulan domain. CEO = semua domain. |
| K6 | **Pull**: Hermes yang bertanya. Webapp tidak tahu Hermes ada (tanpa trigger/webhook baru di POS/stok/absensi). |
| K7 | Login webapp Hermes = **SSO akun Suka Shawarma**; akses bot ditentukan role. |
| K8 | **Larangan data tetap** (§6). Keluar hanya agregat + nama yang perlu untuk bertindak. |
| K9 | Antarmuka = **MCP lewat HTTP**. Fallback REST+OpenAPI dari definisi alat yang sama. |
| K10 | Notifikasi lewat **satu Master Bot Telegram, satu arah**, banyak grup divisi, pesan berlabel divisi. Pesan masuk diabaikan. Userbot dilarang. |
| K11 | **Digest terjadwal**, bukan per kejadian (§7). |
| K12 | Teks digest **dirakit template di API** (fungsi murni ber-test). AI tak boleh mengarang angka. |
| K13 | Kesegaran: tertinggal beberapa menit OK — pakai cache laporan yang ada. |
| K14 | Empat gerbang sebelum domain dinyalakan (§9). |

## 4. Arsitektur

```
Hostinger VPS (IP statis)                    Coolify — admin-dashboard
┌───────────────────────────┐   HTTPS + Bearer ┌──────────────────────────────┐
│ Hermes Agent              │ ───────────────► │ /api/hermes/mcp              │
│  ├ webapp bos (SSO)       │   kunci per bot  │  ├ autentikasi kunci + IP    │
│  ├ jadwal digest          │                  │  ├ filter alat per scope     │
│  └ Master Bot Telegram ───┼─► grup divisi    │  ├ log panggilan             │
│     (satu arah)           │                  │  └ alat → fungsi laporan     │
│ LLM: 9Router → Claude /   │                  └──────────────────────────────┘
│      Gemini               │
└───────────────────────────┘
```

- Middleware admin-dashboard **dilewati** untuk `/api/hermes/*` (pola sama dengan
  `/api/asisten/*`) — route memeriksa kunci sendiri; itulah satu-satunya gerbang.
- Alat dibaca dengan service role **di dalam** fungsi alat, tetapi hanya melalui
  fungsi laporan yang sudah ada; scope kunci dicek sebelum alat dijalankan.
- IP klien diambil dari header yang di-set proxy Coolify (hop terakhir), **bukan**
  `X-Forwarded-For` mentah dari klien.

## 5. Kunci, scope, log

Tabel baru (nama final di plan):
- `hermes_api_key` — `id`, `nama` (mis. "Bot Gudang"), `hash_kunci`, `prefix` (8 char,
  untuk dikenali di log), `scope text[]` (domain), `ip_diizinkan inet[]`, `aktif`,
  `dibuat_oleh`, `dibuat_at`, `dicabut_at`, `terakhir_dipakai_at`.
- `hermes_api_log` — `kunci_id`, `alat`, `argumen` (dipangkas), `status`, `durasi_ms`,
  `ip`, `at`. Tanpa isi jawaban.
- RLS: `REVOKE ALL FROM anon, authenticated`; baca/kelola hanya admin/owner lewat
  server action dengan `requireRole`.

Halaman admin `/dashboard/sistem/hermes` (ADMIN/OWNER): buat kunci (tampil sekali),
pilih scope & IP, cabut, lihat log.

Scope = domain: `penjualan`, `gudang`, `absensi`, `finance`. Kunci CEO = semua domain.

## 6. Larangan data (tetap, berlaku untuk semua kunci termasuk CEO)

Tidak ada alat yang mengembalikan:
- gaji / kasbon **per orang** (`payroll_records`, `cash_advances`) — boleh total per outlet;
- NIK, no. HP, alamat, email staf;
- foto selfie absen, `face_descriptor`, `ref_photo_url`;
- data pelanggan aplikasi (`retail.*` nama/HP).

Diizinkan: angka agregat per outlet/hari, nama outlet, nama crew yang telat, nomor SJ.
Ditegakkan dengan test otomatis yang memindai output setiap alat (§9 gerbang 3).

## 7. Domain & digest (tahapan)

Urutan: **penjualan → gudang → absensi → finance.** Domain berikutnya dimulai setelah
gerbang domain sebelumnya lolos.

Setiap jawaban alat membawa: `sumber`, `dihitung_pada`, `kelengkapan`
(`lengkap` | `sebagian` + alasan). Kegagalan mengambil data = galat eksplisit,
**tidak pernah** `0`.

### 7.1 Penjualan (tahap 1)
Outlet terhitung: `type IN ('internal','mitra')`, tanpa `ss-backup` & outlet tes.
SS Online dilaporkan **terpisah**, tidak dicampur.

Alat: `penjualan_ringkasan(tanggal|rentang, outlet?)`, `penjualan_peringkat_outlet`,
`penjualan_menu_terlaris`, `laporan_pagi_ceo(tanggal)`.

Laporan pagi CEO (07:00, angka kemarin):
1. omzet + perbandingan hari sama minggu lalu; 2. jumlah transaksi;
3. outlet tertinggi & terendah; 4. 3 menu terlaris;
5. satu baris dari domain lain yang sudah aktif.
**Tidak** memuat laba (OPEX bulanan baru masuk akhir bulan) atau stok kritis per bahan.

### 7.2 Gudang (tahap 2)
- Ringkasan kiriman kemarin (dibuat / diterima / belum).
- SJ `dikirim` yang belum diverifikasi outlet.
- Permintaan bahan `menunggu` > 12 jam.
Batas ditulis di kode (bukan halaman setelan).

### 7.3 Absensi (tahap 3)
- Masuk & telat hari ini (nama, outlet, menit telat) — status dari `hitung_status_absen`.
- Rekap sehari + jumlah telat per orang bulan berjalan.
- **Tidak** melaporkan "belum absen": sistem tak punya jadwal shift per orang (jam shift
  baru tercatat saat absen; 14 hari terakhir mayoritas ikut global 13:00, sebagian
  08/09/10/15).
- **Tidak** ada kolom tindakan — aturan tindakan dibiarkan (keputusan 2026-10-07).

### 7.4 Finance (tahap 4)
Isi di-grill ulang saat tahapnya tiba. Batas yang sudah pasti: §6.

### Jadwal digest (dijalankan Hermes, teks dari API)

| Jam WIB | Grup | Alat |
|---|---|---|
| 07:00 | Owner | `laporan_pagi_ceo` |
| 07:00 | Gudang | ringkasan kiriman kemarin |
| 10:00, 16:00 | Gudang | permintaan menggantung |
| 21:30 | Gudang | kiriman hari ini belum diverifikasi |
| 13:30 | HRD | masuk & telat |
| 22:30 | HRD | rekap sehari + telat bulan ini |

## 8. Webapp bos & login SSO (diperbarui 2026-10-07)

- `hermes dashboard` bawaan = **panel admin mesin** (kunci, config, MCP, cron) → khusus
  dev lewat tunnel SSH, **tidak pernah publik**.
- Webapp bos = **app baru di monorepo** (mis. `apps/bot`) di **`bot.sukashawarma.com`**,
  di-deploy via Coolify. Cookie SSO `.sukashawarma.com` + `@suka/auth` sudah memberi
  identitas & role → **endpoint `/api/hermes/v1/sesi` tidak diperlukan** (dibatalkan).
- Webapp memilih **profil Hermes** sesuai role, memanggil **API server Hermes**
  (OpenAI-compatible, port 8643 di VPS) dengan kunci API server; Hermes tak terbuka publik.
- Dibangun **setelah** MCP domain penjualan tersambung dan Hermes terbukti stabil.

Pemetaan role → profil/bot (dipegang webapp):

| Role | Bot |
|---|---|
| owner, admin, developer | semua (CEO) |
| admin_finance | Finance |
| admin_hr | HRD |
| kitchen, purchasing | Gudang |

Staf nonaktif di `outlet_staff` → akses bot ikut hilang.

## 8b. Kondisi VPS (2026-10-07)

- VPS Hostinger `srv1892441` **dipakai bersama** Hermes milik Rendy (root, terminal aktif,
  memegang `SUPABASE_SERVICE_ROLE_KEY` — disengaja). Hermes SS = user Linux `suka-hermes`.
  Pemisahan = **kerapian, bukan keamanan** terhadap root. Detail: `docs/RUNBOOK-HERMES-VPS.md`.
- Konsekuensi untuk K4: allowlist IP **tak bisa membedakan** Hermes SS dari Hermes Rendy
  (IP sama). Kunci per bot + scope tetap pengaman utama; allowlist tetap dipasang untuk
  menolak panggilan dari luar VPS.
- 9Router berjalan di VPS yang sama (port 20128); Hermes SS memanggilnya via `127.0.0.1`.
- Toolset bawaan Hermes dikunci per platform (hanya `clarify` + MCP SS). Alat bawaan
  dinyalakan hanya di profil bot yang membutuhkannya.

## 9. Gerbang per domain

1. **Cocok angka:** 3 tanggal berbeda, output alat = layar webapp setara, sama persis
   (dicatat di `supabase/verifikasi/hermes/`).
2. **Uji kunci:** kunci beda scope ditolak; IP lain ditolak; kunci dicabut langsung mati.
3. **Uji larangan data:** test otomatis — nol field §6 di output alat mana pun.
4. **Masa uji 1 minggu** di grup Telegram uji (hanya dev), baru pindah ke grup bos/divisi.

## 10. Kewajiban di sisi Hermes (pemilik: dev)

- System prompt: *setiap angka wajib dari hasil alat di percakapan ini; bila alat gagal
  atau tak ada, katakan "data tidak tersedia" + alasannya; jangan memperkirakan.*
- Digest = teruskan teks dari API apa adanya; AI hanya boleh menambah satu kalimat
  komentar di luar blok angka.
- Master Bot satu arah; anggota tiap grup dijaga (grup Owner = bos saja).
- Saat install: **verifikasi Hermes bisa MCP lewat HTTP dengan header `Authorization`**.
  Jika tidak → pakai fallback REST+OpenAPI (definisi alat sama).

## 11. Terbuka

- Isi domain finance (tahap 4).
- Webapp `bot.sukashawarma.com` (§8) — plan terpisah.
- Bot Admin WA: butuh WhatsApp Business API resmi.
