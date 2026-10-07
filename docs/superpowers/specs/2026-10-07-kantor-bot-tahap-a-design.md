# Kantor Bot — Tahap A: Kantor Pixel-Art + Status Hidup (apps/bot)

**Tanggal:** 2026-10-07 · **Status:** desain disetujui, menunggu tinjauan spec · **App:** `apps/bot` (`agents.sukashawarma.com`)

## 1. Latar & tujuan

Owner ingin melihat bot divisi Hermes (Bot CEO/"MANAGER UTAMA", Bot HRD, nanti Gudang &
Finance) "bekerja" sebagai karakter pixel-art di sebuah kantor, terinspirasi
[Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT). Tiga tujuan sekaligus,
dipecah menjadi tiga tahap berurutan, masing-masing spec + plan sendiri:

| Tahap | Isi | Status |
|---|---|---|
| **A** | Kantor pixel-art + status hidup tiap bot | **spec ini** |
| B | Klik karakter → panel pantau (panggilan alat terakhir, galat/ditolak hari ini, durasi, laporan pagi) | nanti |
| C | Dari panel → tombol "Ngobrol" membuka chat bot itu (gerbang role chat existing) | nanti |

Tahap A sengaja dirancang agar B dan C hanya menambah, tidak membongkar (lihat §5.5).

## 2. Keputusan (owner, 2026-10-07)

| # | Keputusan |
|---|---|
| K1 | Tujuan: pajangan + alat pantau + pemilih bot — dikerjakan bertahap A → B → C. |
| K2 | Yang boleh melihat: **owner + admin + developer** (`is_owner_or_admin()`) yang staf aktif. |
| K3 | Aset: **karakter Metro City (JIK-A-4)** + lantai/dinding/furnitur bawaan Pixel Agents. Bukan aset bertema dapur sendiri (ditunda). |
| K4 | Kesegaran data: **polling ±10 detik lewat server**, bukan realtime. |
| K5 | Pendekatan: **porting subset engine Pixel Agents ke `apps/bot`** (bukan menjalankan Pixel Agents utuh + iframe, bukan versi DOM/CSS mini). |
| K6 | Pembacaan log: **fungsi DB `status_kantor_bot()` SECURITY DEFINER**, bukan menambah `SUPABASE_SERVICE_ROLE_KEY` ke `apps/bot`. |

### Lisensi aset (diperiksa 2026-10-07)

- **Karakter Metro City:** label itch.io "Creative Commons Zero v1.0 Universal"; penulis
  menyatakan pemakaian komersial boleh; atribusi tidak wajib (tetap dicantumkan).
- **Lantai/dinding/furnitur Pixel Agents:** tak punya catatan asal sendiri di repo → mengikuti
  lisensi MIT repo (Copyright (c) 2026 Pablo De Lucca). Teks MIT disertakan di `public/kantor/KREDIT.md`.
  Bila kelak ternyata bermasalah, gambar bisa diganti tanpa menyentuh kode.
- **Kode engine:** MIT; tiap berkas hasil porting memuat header asal + lisensi.

## 3. Fakta data (DB live, 2026-10-07)

- Kunci aktif: **MANAGER UTAMA** (scope penjualan) dan **Bot HRD** (scope absensi). Dua kunci
  nonaktif (termasuk "UJI LOKAL").
- `hermes_api_log`: 36 baris / 24 jam — volume sangat kecil.
- `hermes_api_log` **tidak** ada di publikasi `supabase_realtime` dan **tidak punya policy RLS**
  (hanya service role yang bisa membaca). Tidak diubah oleh spec ini.
- `hermes_api_log` adalah **satu-satunya** sinyal yang menangkap semua aktivitas bot:
  percakapan Telegram langsung ke Hermes tanpa lewat `apps/bot`, hanya panggilan alat MCP yang
  tercatat di sisi kita.
- Satu kunci = satu bot (meja).

## 4. Arsitektur & aliran data

```
Browser /kantor (Canvas 2D, React)
   │  GET /api/kantor/status   tiap 10 dtk; dijeda saat tab tersembunyi (visibilitychange)
   ▼
apps/bot route handler ── gerbang ambilSesiKantor(): sesi SSO + is_owner_or_admin() + status='active'
   │  supabase.rpc('status_kantor_bot')   (sesi pengguna, bukan service role)
   ▼
Supabase: hermes_api_key (meja) + hermes_api_log (aktivitas)
```

### 4.1 Gerbang `ambilSesiKantor()`

`ambilSesi()` existing (`src/lib/server/sesi.ts`) mewajibkan role terpetakan ke profil Hermes
(`src/lib/peran.ts`, saat ini hanya `developer`) — owner/admin akan ditolak. Maka `/kantor`
mendapat gerbang sendiri: SSO + `is_owner_or_admin()` = true + `outlet_staff.status = 'active'`,
**tanpa** syarat profil. Bagian bersama (cookie → client → `getVerifiedUserId` → baca staf +
`is_owner_or_admin`) diekstrak menjadi satu fungsi yang dipakai kedua gerbang — tidak ada salinan
logika. Perilaku `ambilSesi()` untuk chat tidak berubah.

### 4.2 Fungsi DB `status_kantor_bot()`

Migration baru (hanya fungsi; nol perubahan tabel, data, publikasi):

- `SECURITY DEFINER`, `SET search_path = public`, `STABLE`.
- Baris pertama: bila `is_owner_or_admin()` bukan true → `RAISE EXCEPTION` dengan
  `ERRCODE = '42501'`.
- Mengembalikan satu baris per kunci **aktif** (`aktif = true`):
  `id uuid, nama text, scope text[], dibuat_at timestamptz,
   terakhir_at timestamptz, status_terakhir text, alat_terakhir text,
   panggilan_hari_ini int`
  - `terakhir_at`/`status_terakhir`/`alat_terakhir`: dari baris log terbaru kunci itu (24 jam
    terakhir; NULL bila tidak ada).
  - `panggilan_hari_ini`: jumlah log sejak 00:00 WIB hari ini.
- **Tidak pernah** mengembalikan `prefix`, `hash_kunci`, `ip_diizinkan`, `ip`, maupun `alasan`.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated`.
- Timestamp migration: cek `schema_migrations` hari itu + `ls supabase/migrations | cut -c1-14 | sort | uniq -d`
  sebelum memilih; jangan memakai timestamp 2030; verifikasi stempel dengan SELECT setelah apply.

### 4.3 Route `GET /api/kantor/status`

- Gerbang `ambilSesiKantor()`: 401/403 → `{ galat: 'Tidak punya akses.' }` (pola route `apps/bot` yang sudah ada).
- Galat `42501` dari RPC → 403 (bukan 500). Galat lain → 502 `{ galat: 'Gagal memuat status bot.' }`.
- `Cache-Control: no-store`.
- Respons: `{ diambilAt: string, meja: Meja[] }`,
  `Meja = { id, nama, scope, keadaan, alatTerakhir, terakhirAt }` — `keadaan` dihitung di server
  dengan fungsi murni `keadaan.ts` (§5.2), memakai jam server.

## 5. Halaman `/kantor` & engine

### 5.1 Berkas

| Lokasi | Isi |
|---|---|
| `src/kantor/engine/` | Porting dari `pixel-agents/webview-ui/src/office/engine/` (+ `sprites/` seperlunya): renderer Canvas 2D, game loop, state machine karakter, penempatan kursi, pathfinding. **Tidak ikut:** editor layout, pet, suara, WebSocket, server Fastify. Header tiap berkas: asal + lisensi MIT. |
| `src/kantor/keadaan.ts` | Fungsi murni: baris RPC + `sekarang` → `keadaan`. |
| `src/kantor/peta.ts` | Fungsi murni: daftar meja → penugasan kursi + perintah animasi ke engine. |
| `src/components/kantor/KantorApp.tsx` | Kanvas, polling, kartu nama, pita status, fallback daftar teks. |
| `src/app/kantor/page.tsx` | Gerbang server (`ambilSesiKantor`) + render. |
| `src/app/api/kantor/status/route.ts` | §4.3. |
| `public/kantor/assets/` | Sprite karakter Metro City, lantai/dinding/furnitur Pixel Agents, `default-layout-1.json`, `asset-index.json` & `furniture-catalog.json` (dibangkitkan sekali dari manifest upstream), `KREDIT.md`. |

### 5.2 Aturan keadaan (`keadaan.ts`)

Dievaluasi berurutan; yang pertama cocok menang. Jam = WIB (Asia/Jakarta).

| # | Kondisi | Keadaan |
|---|---|---|
| 1 | `status_terakhir ∈ {galat, ditolak}` dan `sekarang − terakhir_at ≤ 10 menit` | `galat` |
| 2 | `status_terakhir = ok` dan `sekarang − terakhir_at ≤ 60 detik` | `bekerja` |
| 3 | jam `sekarang` di luar 07:00–22:59 | `tidur` |
| 4 | `panggilan_hari_ini > 0` | `siaga` |
| 5 | selainnya | `tidur` |

Batas inklusif (tepat 60 dtk = `bekerja`, tepat 10 mnt = `galat`). Konstanta bernama
(`JENDELA_BEKERJA_DTK = 60`, `JENDELA_GALAT_MNT = 10`, `JAM_BANGUN = 7`, `JAM_TIDUR = 23`).

### 5.3 Keadaan → animasi

Memakai primitif engine Pixel Agents apa adanya (dikoreksi saat menyusun plan, setelah membaca
`officeState.ts` upstream — engine tidak punya pose "berdiri di samping meja" atau "tidur"):

| Keadaan | Perintah engine | Tampilan |
|---|---|---|
| `bekerja` | `setAgentActive(id, true)` + `setAgentTool(id, alatTerakhir)` | Berjalan ke kursi, mengetik/membaca; PC di meja menyala. Kartu nama memuat `alatTerakhir`. |
| `siaga` | `setAgentActive(id, false)` | Perilaku diam bawaan engine (berkeliling/istirahat). |
| `galat` | `setAgentActive(id, false)` + `showPermissionBubble(id)` | Gelembung perhatian bawaan engine di atas kepala; kartu nama merah dengan "!". |
| `tidur` | `setAgentActive(id, false)` | Kartu nama redup dengan "z z". |

### 5.4 Layout & pembagian meja

- Layout = **layout bawaan Pixel Agents** (`default-layout-1.json`, 21×22 tile) apa adanya; tidak
  membuat layout sendiri. Kapasitas = jumlah kursi yang dihitung engine dari layout itu.
- Urutan masuk kantor **stabil**: urut `dibuat_at` naik (tiebreak `id`), sesuai urutan RPC.
  Id karakter engine = hash stabil dari `id` kunci, jadi karakter tak tertukar antar polling.
- Kunci aktif melebihi kapasitas: sisanya tampil di daftar teks di bawah kanvas (nama + keadaan)
  — tidak disembunyikan.
- Karakter (sprite) dipilih stabil dari `id` kunci (hash → indeks sprite).
- Kartu nama di atas tiap karakter: nama kunci + label scope.

### 5.5 Kait untuk Tahap B/C (dibangun sekarang, dipakai nanti)

Karakter dapat diklik/ditap; `KantorApp` memancarkan `onPilihMeja(id)`. Di Tahap A klik hanya
menyorot karakter + kartu namanya. Panel pantau (B) dan tombol "Ngobrol" (C) kelak mendengarkan
event ini.

### 5.6 Tampilan

- Skala kanvas bilangan bulat (pixel tajam), `image-rendering: pixelated`.
- HP: kanvas mengikuti lebar; kartu nama pindah ke daftar di bawah kanvas.
- `/kantor?layar=penuh`: sembunyikan header (untuk TV).
- Header `apps/bot` mendapat tautan "Kantor", hanya ditampilkan bila gerbang kantor lolos.
  Tile portal **tidak** ditambahkan.

## 6. Penanganan galat

| Kejadian | Perilaku |
|---|---|
| Polling gagal (jaringan / 5xx) | Pertahankan keadaan terakhir; pita "Data terakhir HH:MM — mencoba lagi". Jangan mengosongkan kantor. |
| 401 | Arahkan ke portal (pola halaman chat). |
| 403 | Halaman "Tidak punya akses" (pola halaman chat). |
| Aset gagal dimuat | Ganti kanvas dengan daftar teks nama + keadaan. |
| Nol kunci aktif | Kantor kosong + teks "Belum ada bot aktif". |

## 7. Pengujian

- **Vitest** `keadaan.test.ts`: tiap baris aturan §5.2, batas tepat 60 dtk & 10 mnt (dan +1),
  jam 06:59/07:00/22:59/23:00 WIB, kunci tanpa log, `ditolak` lama (> 10 mnt) jatuh ke aturan berikut.
- **Vitest** `peta.test.ts`: pembagian meja stabil terhadap urutan input, tiebreak `id`,
  kunci melebihi kapasitas → sisa ke daftar, 0 kunci, id karakter stabil per `id` kunci.
- **Vitest** gerbang route (pola `src/app/api/kunci.test.ts`): 401/403/42501→403.
- **SQL** `supabase/verifikasi/kantor_bot/t1.sql` (transaksi + `ROLLBACK`): owner/admin
  terbaca; crew ditolak 42501; anon tanpa EXECUTE; kolom sensitif tidak ada di keluaran;
  kunci nonaktif tidak muncul. Disertai kontrol negatif yang benar-benar melempar error.
- `yarn workspace @suka/bot type-check` + `test` + `next build`.
- **Smoke manual:** buka `/kantor` sebagai owner/admin → tanya Bot HRD lewat Telegram →
  karakter HRD mengetik ≤10 dtk → kembali siaga ±60 dtk kemudian; login crew → 403.

## 8. Di luar cakupan

Panel pantau (B), klik untuk mengobrol (C), tile portal, editor layout, pet, suara, realtime,
aset bertema dapur sendiri, perubahan pada `hermes_api_log`/`hermes_api_key` (kolom, RLS,
publikasi), perubahan perilaku chat.

## 9. Deploy

- Migration `status_kantor_bot()` applied + terstempel + diverifikasi ke katalog sebelum redeploy.
- Redeploy `apps/bot` (tidak ada env baru).
