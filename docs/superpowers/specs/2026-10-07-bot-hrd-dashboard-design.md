# Bot HRD di Dashboard HR

**Tanggal:** 2026-10-07
**Status:** Keputusan owner lengkap (D1–D11). Belum ada kode.
**Induk:** `docs/superpowers/specs/2026-10-07-hermes-api-design.md` (aturan Hermes K1–K14
& larangan data §6 tetap berlaku). Spec ini mengubah urutan & isi domain `absensi`.

## 1. Latar & keputusan owner (2026-10-07)

| # | Keputusan |
|---|---|
| D1 | Domain `absensi` **mendahului** `gudang` (gudang sedang dikerjakan pihak lain). Mengubah urutan §7 spec induk. |
| D2 | Bot HRD tampil **lebih dulu di dashboard HR** (`apps/HR`), bukan menunggu `bot.sukashawarma.com`. |
| D3 | Otaknya tetap **Hermes** profil `hrd` (VPS) → MCP domain `absensi` di admin-dashboard. Tanpa AI langsung di app HR. |
| D4 | Pengguna: **admin_hr, owner, admin, developer**. |
| D5 | Bentuk: **widget chat melayang** di semua halaman HR (pola avatar SUKA Bot, tanpa animasi chef). |
| D6 | Isi tahap 1: kehadiran & telat, **alpa & belum hadir**, cuti & izin, kasbon agregat, ceklist harian. |

D6 memperluas spec induk §7.3, yang semula menolak "belum hadir" karena dianggap tak ada
jadwal per orang. Kenyataannya papan kehadiran (`apps/absensi/src/features/board/board.ts`)
sudah menghitung `belum`/`alpha` memakai jam masuk outlet/shift + jadwal khusus staf.

## 2. Arsitektur

```
Browser (dashboard HR, sesi SSO)
   │  POST /api/bot-hrd/chat  (server action/route di apps/HR)
   ▼
apps/HR server ── cek sesi + role (requireRole) ──► Hermes API server  /p/hrd/v1/chat/completions
   (Coolify)        kunci API_SERVER_KEY profil hrd       (127.0.0.1:8643 di VPS, TIDAK publik)
                    disimpan di env server HR saja            │
                                                              ▼
                                         MCP admin-dashboard /api/hermes/mcp  (kunci scope `absensi`)
                                                              │
                                                              ▼
                                         fungsi/view yang sama dengan layar absensi & HR
```

- Browser **tidak pernah** memegang kunci Hermes; semua lewat server HR.
- Riwayat percakapan: tabel per pengguna di Supabase (RLS milik sendiri, maks 50
  percakapan, hanya hari ini) — pola SUKA Bot. `X-Hermes-Session-Id` = id percakapan.
- Hermes memory/skills/session_search **mati** di profil `hrd`; toolset dikunci ke
  `clarify` + MCP `suka` (spec induk §8b, runbook langkah 4).
- Env baru di app HR (Coolify + `ARG/ENV` stage runner Dockerfile — gotcha #1):
  `HERMES_API_URL`, `HERMES_HRD_API_KEY`.

## 3. Alat MCP domain `absensi` (admin-dashboard, `src/lib/hermes/alat/absensi.ts`)

Semua alat: baca-saja, outlet terhitung = `internal`/`mitra` aktif tanpa outlet tes &
`ss-backup`, **termasuk** Kantor Pusat (D8),
membawa `meta.sumber/dihitung_pada/kelengkapan`, gagal = galat eksplisit (bukan 0).

| Alat | Isi | Sumber (wajib sama dengan layar) |
|---|---|---|
| `absensi_hari_ini(outlet?)` | per outlet: hadir, telat (nama + menit), belum hadir, alpa | logika `computeBoard` papan kehadiran |
| `absensi_rekap(tanggal\|rentang, outlet?)` | rekap per hari & per outlet: tepat/telat/alpa | API rekap absensi |
| `absensi_telat_bulan_ini(outlet?)` | jumlah telat & alpa per orang bulan berjalan | sama |
| `cuti_izin(tanggal?, status?)` | siapa cuti/izin hari ini, pengajuan menunggu | `leave_requests` (layar Cuti HR) |
| `kasbon_ringkasan(bulan?, outlet?)` | **per outlet**: total kasbon + jumlah & total nominal pengajuan berstatus menunggu (D9) — tanpa nama/nominal per orang | `cash_advances` (layar Kasbon HR) |
| `ceklist_kepatuhan(tanggal?, outlet?)` | % ceklist harian selesai per outlet | `daily_checklist_records` (layar Ceklist HR) |

Logika `computeBoard` & alpa virtual rekap saat ini **hanya ada di `apps/absensi`**.
Wajib dipindah ke fungsi bersama (package atau fungsi SQL) dan dipakai oleh layar absensi
**dan** alat — bukan disalin (pola "satu sumber rumus").

## 4. Larangan data (spec induk §6, tetap)

Nama crew + outlet + menit telat/status **boleh**. Tidak pernah keluar: gaji & kasbon per
orang, NIK, HP, alamat, email, selfie, `face_descriptor`, `ref_photo_url`. Ditegakkan test
pemindai output tiap alat (gerbang 3).

## 5. Widget di dashboard HR

- Tombol bulat di pojok kanan bawah semua halaman HR; panel chat (HP: layar penuh).
- Tampil hanya untuk role D4 (cek di server; komponen tidak dirender untuk role lain).
- Pesan pembuka: ringkasan absensi hari ini (template dari alat, bukan karangan AI).
- Komponen kustom (tanpa kontrol native browser), mengikuti `@suka/design-system`.
- Riwayat dimuat lazy saat panel dibuka; tanpa realtime.

## 6. Gerbang sebelum dipakai HRD

1. **Cocok angka** 3 tanggal: output alat = papan kehadiran/rekap/layar HR, sama persis.
2. **Uji kunci**: kunci scope `penjualan` ditolak alat absensi; kunci dicabut mati.
3. **Uji larangan data**: test otomatis nol field §4.
4. **Masa uji 1 minggu** dipakai dev/owner dulu, baru dibuka ke admin_hr.

## 7. Keputusan lanjutan owner (2026-10-07)

| # | Keputusan |
|---|---|
| D7 | **Alpa/belum hadir mengikuti rumus yang sekarang** (papan kehadiran & rekap), apa adanya. Staf cuti/libur memang masih bisa terhitung alpa — bot tidak memperbaikinya sendiri. Alat cukup menyertakan catatan di `meta` bahwa cuti/libur belum dikecualikan, dan bot boleh menyebut siapa yang sedang cuti dari alat `cuti_izin` agar HRD bisa menilai. Perbaikan rumus = pekerjaan terpisah (akan ikut mengubah papan kehadiran). |
| D8 | **Staf Kantor Pusat ikut dihitung** (outlet "Kantor Pusat" masuk cakupan alat absensi). Outlet tes & `ss-backup` tetap dikecualikan. |
| D9 | **Kasbon menunggu ditampilkan beserta statusnya**: per outlet = jumlah pengajuan berstatus menunggu + total nominal menunggu, di samping total kasbon. Tetap **tanpa nama & nominal per orang** (§4). |
| D10 | **API server Hermes dinyalakan oleh dev (sesi Claude)** sebagai bagian plan: port 8643, bind `127.0.0.1`, `API_SERVER_KEY` profil `hrd`, toolset dikunci, hanya terjangkau app HR. Dilakukan setelah alat MCP lolos gerbang 1–3, bukan sebelumnya. |
| D11 | **Digest Telegram HRD menyusul** — di luar tahap ini. |

## 8. Keputusan lanjutan (2026-10-07 sore)

| # | Keputusan |
|---|---|
| D12 | **Scope `hr_rinci`** — gaji & kasbon **per orang** (nama + nominal) boleh keluar, **khusus Bot HRD**. CEO/scope lain tidak. Alat baru: `kasbon_daftar` (id, nama, outlet, nominal, sisa, cicilan_bulan, status menunggu/aktif/lunas/ditolak, tanggal) dan `gaji_daftar` (bulan, tahun, outlet → nama, outlet, gaji_pokok, tunjangan, bonus, potongan, total, status). Gaji hanya ditampilkan bila ditanya. **Catatan risiko:** data ini lewat model AI via 9Router dan VPS Hermes yang diakses root bersama. Tetap terlarang: NIK/KTP, HP, alamat, email, rekening bank, selfie/face data, alasan cuti. **Mengubah §4 untuk Bot HRD** (gaji & kasbon per orang tidak lagi dilarang); larangan lain di §4 tetap. |
| D13 | **Aksi agentik dieksekusi langsung oleh widget HR** atas sesi HRD, tanpa klik konfirmasi, lewat blok ```suka-ui``` berjenis `aksi`. Hermes tetap **read-only** (hanya menghasilkan blok; eksekusi di widget). Satu eksekusi per blok, riwayat percakapan **tidak dijalankan ulang** saat dimuat, maksimal **5 aksi per pesan**. Alur **tawar-lalu-eksekusi**: bot boleh menawarkan aksi secara proaktif lewat blok `tawaran` (teks ≤300, 1–4 pilihan; tombol mengirim `pesan` sebagai pesan pengguna, maks 1 tawaran per balasan) tetapi baru mengeluarkan blok `aksi` setelah pengguna setuju; perintah eksplisit langsung ("setujui cuti Cici") dieksekusi tanpa tawaran. Penolakan tanpa alasan: tawaran meminta alasan dulu. |
| D14 | **Daftar aksi tahap ini:** `setujui_cuti {id}`, `tolak_cuti {id, alasan wajib}`, `setujui_kasbon {id}`, `tolak_kasbon {id, alasan?}`, `tinjau_ceklist {id, tanggapan?}`, `buka_halaman {path, query?}`, `unduh_rekap_absensi {dari, sampai, outlet_id?}`. |
| D15 | **Alpa mengecualikan** cuti yang disetujui, hari libur role kantor, dan Off di Shift Roster (PR #58). Menggantikan D7 (bot tak lagi perlu menandai cuti/libur sebagai terhitung alpa; daftar `cuti`/`libur` tetap boleh ditampilkan sebagai konteks). |
