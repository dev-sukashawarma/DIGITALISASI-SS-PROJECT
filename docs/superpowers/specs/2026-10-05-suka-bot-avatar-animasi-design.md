# SUKA Bot — Avatar Animasi (Desain)

**Tanggal:** 2026-10-05
**Status:** Disetujui owner. **Direvisi sore 5 Okt 2026 — lihat §11** (seluruh badan, transparan,
bisa digeser). §11 MENGGANTIKAN bagian yang bertentangan di §4–§8.
**App:** `apps/portal` (widget SUKA Bot)
**Terkait:** `docs/superpowers/specs/2026-10-03-suka-bot-design.md` §7 (avatar "3D
pre-render dengan pose diam / berpikir / rekap siap / bingung + animasi ringan")

## 1. Masalah

Avatar SUKA Bot saat ini (`AvatarSukaBot.tsx`) adalah `<img>` webp per pose plus
animasi CSS bawaan (`bounce`/`pulse`). Berkas webp-nya belum pernah ada, jadi yang
tampil selalu lingkaran oranye "SB". Owner ingin karakter yang benar-benar bergerak
dan bereaksi.

## 2. Keputusan owner (brainstorming 5 Okt 2026)

| # | Keputusan |
|---|---|
| K1 | Karakter = chef berjanggut bertopi putih & celemek cokelat, render bergaya 3D ala Pixar (`docs/aset/suka-bot/chefss.jpeg`, latar hijau). |
| K2 | Tingkat "hidup": **interaktif sekarang** (reaksi kursor, hover, klik, transisi antar pose), **"berbicara" nanti** (tahap C, tidak di spec ini). |
| K3 | Gerak dibuat dari **klip video AI per pose** (Google Flow / Veo), bukan SVG berlapis. Alasan: gaya 3D karakter hilang kalau di-tracing ke SVG; di ukuran 56 px gerak badan yang luwes lebih terbaca daripada pupil bergeser. |
| K4 | Klip **berulang** (`diam`, `berpikir`, nanti `bicara`) wajib dibuat dengan mode *Frames to Video* (frame awal = frame akhir = `chefss.jpeg`). Klip **sekali-putar** (`rekap`, `bingung`, `sapa`) tidak perlu. |
| K5 | `rekap` dan `bingung` **main sekali** lalu kembali ke `diam`. Titik merah tetap jadi tanda rekap belum dibuka. |
| K6 | Reaksi interaktif lewat **`framer-motion`** di atas video. |
| K7 | **Video mentah Flow tidak masuk git** (disimpan di Drive tim). Yang masuk git: skrip pengolah, konfigurasinya, `chefss.jpeg`, panduan klip, dan hasil olahan. |

Ditolak selama brainstorming: SVG berlapis + kode (gaya 3D hilang), Live2D (perlu
rigging di Cubism Editor + lisensi SDK), Rive/Lottie (perlu animator), potongan
gambar ala wayang (sambungan kaku pada gaya 3D, kedip & mulut butuh gambar tambahan).

## 3. Klip sumber

Video mentah di `docs/aset/suka-bot/` (lokal, di-gitignore), 1080×1920, 24 fps,
H.264 + AAC. Panduan pembuatan & prompt: `docs/aset/suka-bot/PANDUAN-KLIP-ANIMASI.md`.

| Klip | Berkas sumber | Cara putar | Segmen dipakai (frame) |
|---|---|---|---|
| `diam` | `Chef_breathing_and_smiling_1080p_20261005152301.mp4` | Berulang | 5–174 (7,0 dtk) |
| `berpikir` | `Chef_stroking_beard_thoughtfully_1080p_20261005152518.mp4` | Berulang | 6–139 (5,5 dtk) |
| `rekap` | `Chef_smiling_and_waving_happily_20261005145342.mp4` | Sekali | dari frame 0, ujung ditentukan saat implementasi (buang bagian diam di akhir) |
| `bingung` | `Chef_acting_confused_and_apologetic_20261005145537.mp4` | Sekali | idem |
| `sapa` | `Chef_giving_thumbs_up_1080p_20261005145710.mp4` | Sekali | idem |
| `bicara` | `Chef_talking_to_viewer_1080p_20261005145756.mp4` | — | **Tidak diolah.** Tahap C; perlu dibuat ulang dengan *Frames to Video*. |

Hasil ukur (5 Okt 2026, wilayah dada ke atas, 64×64 grayscale, RMS):
- Klip *Frames to Video*: selisih frame akhir vs awal 1,1–1,3, lebih kecil dari
  gerak normal per frame (3,0–4,0) → **tersambung tanpa pelarutan**.
- Veo menahan pose di ujung klip (beku 6+18 frame di `diam`, 7+5 di `berpikir`) →
  segmen dipotong menyisakan 1 frame di tiap ujung.
- Klip satu-gambar (percobaan pertama): sambungan terbaik masih 3–5× gerak normal
  per frame. Karena itu hanya dipakai sebagai klip sekali-putar.

## 4. Pengolahan (skrip yang bisa dijalankan ulang)

`scripts/suka-bot/olah_klip.py` (Python 3 + numpy + Pillow + ffmpeg di PATH; nama
ber-garis-bawah agar bisa diimpor test) dengan konfigurasi `scripts/suka-bot/klip.json`.
Per klip:

1. Potong segmen sesuai konfigurasi, buang audio.
2. Potong sebatas dada: kotak **980×980 di (20, 120)** dari 1080×1920, skala 320×320.
   **Satu kotak yang sama untuk semua klip** — kotak berbeda per klip membuat ukuran
   chef melompat saat pelarutan antar klip. Kotak ini dipilih agar lambaian `rekap`
   (tangan sampai x≈40 px) muat; kotak 900 di (90,180) dari pratinjau memotong jari.
3. Buang hijau dengan **dominansi hijau**, bukan `chromakey` ffmpeg (yang terbukti
   membuat janggut & wajah tembus): `d = G − max(R,B)`,
   `alpha = clip(1 − (d − 18)/(55 − 18), 0, 1)`; despill `G = min(G, max(R,B))`.
4. Tempel di latar oranye `#f29744` (latar menyatu di video → tidak perlu kanal
   alfa, jalan di semua browser termasuk Safari/iOS).
5. Encode H.264 `yuv420p`, `+faststart`, tanpa audio. Target ≤ 250 KB per klip
   (pratinjau: 93–206 KB).
6. Ekspor gambar cadangan `<klip>.webp` 320×320 dari frame yang paling mewakili
   pose (indeks frame di konfigurasi).
7. Tulis `apps/portal/src/components/sukaBot/avatar/klip.gen.ts`: daftar klip,
   cara putar, dan sidik (hash isi berkas) untuk versi URL.

`olah_klip.py --periksa` gagal dengan pesan jelas bila:
- klip berulang: selisih frame akhir vs awal ≥ median gerak per frame klip itu;
- ada > 2 frame beku berturut-turut di ujung klip;
- ada piksel dengan dominansi hijau di atas ambang pada hasil akhir (sisa hijau);
- berkas > 250 KB;
- gambar cadangan / `klip.gen.ts` hilang atau sidiknya tidak cocok dengan video.

## 5. Aset yang tayang

`apps/portal/public/suka-bot/`:
- `diam.mp4`, `berpikir.mp4`, `rekap.mp4`, `bingung.mp4`, `sapa.mp4`
- `diam.webp`, `berpikir.webp`, `rekap.webp`, `bingung.webp`, `sapa.webp`
- `README.md` — diganti: berkas di sini **hasil olahan skrip**, jangan diedit
  tangan; cara mengolah ulang.

Cache: URL memakai sidik dari `klip.gen.ts` (`diam.mp4?v=<sidik>`), dan
`next.config.mjs` portal menambahkan header `Cache-Control: public,
max-age=31536000, immutable` untuk `/suka-bot/:path*`. Klip baru → sidik baru →
browser mengambil ulang.

## 6. Komponen

`apps/portal/src/components/sukaBot/`:

| Berkas | Tugas |
|---|---|
| `AvatarSukaBot.tsx` | **Antarmuka tetap**: `pose` (`diam│berpikir│rekap│bingung`) + `ukuran`. `SukaBotWidget` & `PanelSukaBot` tidak berubah. Isi: gambar cadangan + dua `<video>` bertumpuk + lapisan `framer-motion` untuk reaksi. |
| `avatar/rencanaPutar.ts` | Fungsi murni (tanpa React): dari keadaan + kejadian (pose berubah, klik, klip selesai) → klip yang diputar, berulang/sekali, dan klip berikutnya. |
| `avatar/usePemutarAvatar.ts` | Hook: `useReducer` atas `rencanaPutar`, meneruskan pose/klik/selesai. |
| `avatar/LayarKlip.tsx` | Gambar pose + lapisan `<video>`: memuat klip baru tersembunyi, memutar saat siap, melarutkan 250 ms, melaporkan `ended`/gagal, jeda saat tab tersembunyi, unduh klip lain di latar. |
| `avatar/modeTampil.ts` | Fungsi murni `bolehVideo` (§8). |
| `avatar/condong.ts` + `avatar/useCondongKursor.ts` | Rumus murni condong (§7.3) + hook pemasang `pointermove`. |
| `avatar/klip.gen.ts` | Hasil skrip (§4 langkah 7). Tidak diedit tangan. |

Dependensi baru di `apps/portal/package.json`, keduanya sudah ter-resolve di
`yarn.lock` (lockfile tidak berubah — cek `git diff --stat yarn.lock` = 0):
- `framer-motion: ^11.0.0` (dipakai HR, admin-dashboard, finance, manager,
  owner-dashboard), dimuat dengan `LazyMotion` + `domAnimation`.
- `vitest: ^2.1.0` (dev), plus skrip `"test": "vitest run"`.

## 7. Perilaku

### 7.1 Aturan pemutaran

| Pemicu | Klip | Cara putar | Setelah selesai |
|---|---|---|---|
| pose `diam` | `diam` | berulang | — |
| pose `berpikir` | `berpikir` | berulang selama pose `berpikir` | — |
| pose **berubah ke** `rekap` | `rekap` | sekali | `diam` |
| pose **berubah ke** `bingung` | `bingung` | sekali | `diam` |
| klik avatar | `sapa` | sekali | klip berulang sebelumnya |

- Klip sekali-putar dipicu oleh **perubahan** pose (termasuk pose awal saat
  komponen pertama kali tampil), bukan selama pose bertahan. Widget terus
  mengirim `rekap` selama rekap belum dibuka; chef hanya melambai sekali.
- Prioritas: `berpikir` > `bingung` > `rekap` > `sapa` > `diam`.
- Pose `berpikir` memotong klip sekali-putar yang sedang main.
- Keluar dari `berpikir` terjadi segera (tidak menunggu klip habis).
- Klik saat `berpikir`, saat `rekap`/`bingung` sedang main, atau saat `sapa`
  sedang main → diabaikan (konsekuensi prioritas di atas).

### 7.2 Perpindahan

Dua `<video>` bertumpuk. Klip berikutnya dimuat di elemen tersembunyi; saat
`canplay`, diputar dari awal lalu dilarutkan (opacity) **250 ms**. Klip berulang
memakai atribut `loop` (sambungannya sudah mulus dari pengolahan).

### 7.3 Reaksi interaktif (`framer-motion`)

- **Condong ke kursor**: rotasi maks ±6°, geser maks ±3 px mengikuti posisi
  kursor relatif terhadap avatar, pegas. Hanya bila `(pointer: fine)`.
- **Hover** skala 1,06; **ditekan** skala 0,95 lalu memantul.
- **Muncul pertama kali**: skala 0,6 → 1.
- **Titik merah rekap**: denyut cincin halus (tetap dirender `SukaBotWidget`;
  hanya ditambah kelas animasi).

Sengaja tidak dimasukkan: pengingat berkala (melambai ulang tiap N menit).

## 8. Performa, cadangan, aksesibilitas

**Pemuatan:** gambar `diam.webp` tampil langsung → `diam.mp4` dimuat dan
menggantikannya saat siap → klip lain diunduh di latar setelah `diam` jalan, saat
senggang (`requestIdleCallback`, cadangan `setTimeout`), agar perpindahan pose
tidak menunggu unduhan.

**Gambar cadangan pose dipakai (tanpa video) bila:**
- `prefers-reduced-motion: reduce` — juga tanpa condong & pop; pelarutan
  opacity antar gambar pose tetap.
- `navigator.connection.saveData === true` — video tidak diunduh.
- `video.play()` ditolak atau video gagal dimuat (mis. iOS mode hemat daya) —
  tetap di gambar pose itu; tidak pernah ikon video rusak / kotak hitam.

**Hemat baterai:** video dijeda saat `document.hidden`; hanya satu video berjalan
kecuali selama pelarutan 250 ms.

**Aksesibilitas:** `<video>` `aria-hidden`, `muted`, `playsInline`, tanpa audio.
Label tombol widget tidak berubah. Rekap baru tetap ditandai titik merah (tidak
hanya lewat gerak).

**Error:** pengaman error yang ada di `SukaBotWidget` tetap berlaku; avatar rusak
tidak boleh merusak launcher.

## 9. Pengujian

1. **`avatar/rencanaPutar.test.ts`** (Vitest): pose `rekap` bertahan → sekali lalu
   `diam`; rekap baru saat diam → sekali lagi; `berpikir` memotong lambaian;
   keluar dari `berpikir` segera; klik saat `berpikir` & klik beruntun saat `sapa`
   diabaikan; `sapa` selesai → kembali ke klip berulang sebelumnya; mode tanpa
   animasi → selalu gambar.
2. **`olah_klip.py --periksa`** lolos untuk semua klip (§4).
3. **Uji manual** di portal lokal (`yarn dev`, port 3010) dengan akun
   owner/admin:
   - [ ] launcher dibuka → pop, melambai sekali bila ada rekap baru, lalu diam
         dengan titik merah berdenyut
   - [ ] kirim pertanyaan → berpikir; jawaban datang → keluar segera
   - [ ] matikan jaringan lalu kirim → bingung sekali → diam
   - [ ] gerakkan mouse → condong; hover → membesar; klik → jempol sekali
   - [ ] Windows "Animation effects" mati → hanya gambar pose
   - [ ] DevTools Network: tiap klip diunduh sekali; muat ulang → dari cache
   - [ ] lebar 375 px (HP); Safari/iPhone bila tersedia
4. **`yarn type-check` di `apps/portal`** wajib 0 error — `next.config.mjs` portal
   memakai `typescript.ignoreBuildErrors: true`, jadi build tidak menangkap error
   tipe. Lalu `next build` portal sukses.

## 10. Di luar cakupan

- Tahap C "berbicara" (klip `bicara` berulang + pemicunya dari status stream
  jawaban).
- Pengingat berkala rekap.
- Animasi di app selain portal.

## 11. Revisi (sore 5 Okt 2026): seluruh badan, transparan, bisa digeser

Setelah melihat hasil lingkaran di browser, owner meminta: chef **seluruh badan tanpa
lingkaran**, **bisa digeser**, panel **ikut chef**, dan **tanpa avatar lingkaran** di kepala
panel. Bagian ini menggantikan §4 langkah 2/4–7, §5, §6 (baris `AvatarSukaBot`), dan §7.3
(ukuran).

### 11.1 Keputusan

| # | Keputusan |
|---|---|
| R1 | Chef seluruh badan, latar transparan, tanpa lingkaran. Tinggi tampil 140 px (layar ≥ 640 px) / 110 px (HP). |
| R2 | Format per perangkat: **WebM VP9 alfa** 24 fps untuk Chromium/Firefox/Android; **WebP beranimasi alfa** 12 fps untuk semua browser iOS/iPadOS (mesin WebKit) dan Safari macOS. Alasan: si bos memakai iPhone; prioritas desktop. Ukur 5 Okt: WebM ±250 KB/klip, WebP 12 fps ±400 KB/klip, WebP 24 fps ±740 KB/klip (terlalu berat). |
| R3 | Chef bisa digeser bebas (mouse & sentuh), dibatasi di dalam layar, posisi diingat per perangkat (`localStorage` `sukaBot.posisi`), dijepit ulang saat layar berubah. Geser ≥ 5 px ≠ klik. |
| R4 | Panel muncul di samping chef, di sisi yang menghadap tengah layar, sejajar bawah dengan chef. Bila tidak muat di samping (HP), di atas chef (atau di bawah bila chef di separuh atas), tinggi panel dikecilkan agar tidak menutupi chef (minimal 280 px). Panel ikut bila chef digeser. |
| R5 | Avatar 40 px di kepala `PanelSukaBot` dihapus. Halaman `/asisten`: chef seluruh badan di samping panel (kiri pada ≥ 768 px, di atas pada HP). |
| R6 | Aset MP4 lingkaran & gambar potongan dada dari §5 dihapus dari repo. |

### 11.2 Pengolahan (menggantikan §4 langkah 2, 4–7)

- Satu kotak potong untuk semua klip: **1016×1770 di (0, 106)** — gabungan bounding box kelima
  klip (lambaian `rekap` sampai x = 0 di video sumber), rasio lebar/tinggi 0,574.
- Kunci hijau sama (dominansi hijau, t0 18, t1 55) tapi keluarannya **RGBA** (alfa dari kunci,
  RGB di-despill), bukan ditempel ke oranye.
- Keluaran per klip di `apps/portal/public/suka-bot/`:
  - `<klip>.webm` — VP9 `yuva420p`, tinggi 320, 24 fps, tanpa audio, maks 350 KB.
  - `<klip>.anim.webp` — WebP beranimasi alfa, tinggi 280, 12 fps, loop tak hingga untuk klip
    berulang dan 1 kali untuk sekali-putar, maks 550 KB.
  - `<klip>.webp` — gambar diam transparan (frame `frame_gambar`), tinggi 320.
- `klip.gen.ts` mengekspor `RASIO` dan `KLIP[klip] = { webm, webp, gambar, ulang, durasiMs }`.
- `--periksa` tambahan: kanal alfa benar-benar ada di WebM (pojok transparan, tengah pekat);
  WebP beranimasi > 1 frame dan jumlah loop sesuai; sisa hijau dihitung hanya pada piksel pekat.

### 11.3 Komponen (menggantikan §6 untuk berkas berikut)

| Berkas | Tugas |
|---|---|
| `avatar/modeTampil.ts` | + `pilihFormat(ua, maxTouchPoints): 'webm' \| 'webp'`, `type Sumber = 'webm' \| 'webp' \| 'gambar'`. |
| `avatar/posisi.ts` | Murni: `sudahGeser`, `jepitPosisi`, `posisiAwal`, `ukuranPanel`, `posisiPanel`. |
| `avatar/animWebp.ts` | Ambil WebP beranimasi sekali (cache blob); tiap pemutaran memakai URL blob baru agar animasi mulai dari frame pertama. |
| `avatar/LayarKlip.tsx` | Gambar diam + lapisan WebM (`<video>`) atau WebP (`<img>` URL blob). Klip sekali-putar di jalur WebP/gambar dianggap selesai setelah `durasiMs` (WebP tak punya event `ended`). |
| `AvatarSukaBot.tsx` | Props `{ pose?, tinggi? = 140, ketukan? = 0 }`. Klik ditangani pemanggil; `ketukan` yang bertambah memicu `sapa` (agar geser tidak memicu sapa). Condong berporos di kaki. |
| `useGeserChef.ts` | `useUkuranLayar` + `useGeserChef` (pointer events, ambang 5 px, simpan posisi). |
| `SukaBotWidget.tsx` | Chef `fixed` di posisi geser + panel di `posisiPanel`; pose = pose panel bila terbuka, selain itu `rekap`/`diam`. |
| `PanelSukaBot.tsx` | Tanpa avatar; props baru `onPose?(pose)` dan `ukuran?: {w,h}` (ukuran dari widget). |
| `HalamanAsisten.tsx` | Chef + panel untuk `/asisten`. |
| `middleware.ts` | Matcher meloloskan `.webm` (aset publik, sama dengan `.webp`). |

Tetap berlaku: aturan pemutaran & prioritas (§7.1), pelarutan 250 ms (§7.2), condong ±6°/±3 px,
hover 1,06 / tekan 0,95 / muncul 0,6 → 1, titik merah berdenyut (dipindah ke dekat topi chef),
cache 1 tahun, cadangan gambar (§8).
