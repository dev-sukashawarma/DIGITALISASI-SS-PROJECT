# Design — Absensi UI/UX Redesign (kiosk-first, tanpa GPS)

> Status: Disetujui (2026-06-10) · Modul: M1 (lanjutan) · App: `apps/absensi`
> Terkait: [`docs/PRD.md`](../../PRD.md) §M1 · [spec M1 awal](2026-06-09-m1-absensi-face-matching-design.md) · ADR-003 (face client-side)
> Mengganti keputusan GPS pada spec M1 awal (§1 "tiga lapis": GPS → diganti **liveness acak**).

## 1. Ringkasan & Keputusan Brainstorming

Redesain UI/UX app absensi outlet agar **mudah, cepat, ringan, dan benar-benar anti-curang**, tanpa mengubah model data inti M1 yang sudah jadi. Pendekatan **kiosk-first (Opsi B)**.

Keputusan yang diambil saat brainstorming (2026-06-10):

1. **Hapus GPS.** Device absensi adalah perangkat bersama yang **menetap di outlet** (satu per outlet) — kehadiran fisik sudah terjamin oleh lokasi device, sehingga validasi radius GPS redundan dan hanya menambah friksi (izin lokasi, kegagalan). GPS dibuang end-to-end (frontend + Edge Function), kolom `gps_*`/`distance_m` di DB dibiarkan nullable (tanpa migration destruktif).
2. **Alur absen = auto-deteksi wajah (1:N).** Staff cukup menghadap kamera; sistem mengenali siapa tanpa memilih nama. Menggantikan alur lama "pilih nama → verifikasi 1:1".
3. **Liveness aktif sederhana (pengganti lapisan GPS).** Satu aksi mikro **acak** per absen (kedip / toleh / angguk). Keacakan menggagalkan titip-absen via foto/video rekaman. Diturunkan dari **model landmark yang sudah dimuat** — nol download model tambahan, tetap ringan.
4. **State absen pintar.** Setelah dikenali, sistem cek catatan hari ini → otomatis tahu menampilkan Clock-IN atau Clock-OUT; cegah dobel clock-in.
5. **Fitur baru ronde ini:** (a) Papan Kehadiran Hari Ini, (b) State absen pintar, (c) Export & ringkasan rekap. PIN cadangan ditunda. Toast + bunyi konfirmasi masuk sebagai polish dasar UX (bukan fitur berat).
6. **Ikon tanpa emoji.** Seluruh emoji diganti `lucide-react` (tree-shakeable).
7. **Anti-curang final = 3 lapis:** face match (1:N identify + ambang 1:1) + **liveness acak** + selfie audit. GPS tidak lagi salah satu lapis.

**Anti-goals (YAGNI):** tidak membangun component library besar (Opsi C); tidak menambah PIN cadangan; tidak liveness pasif berbasis ML model tambahan; tidak mengubah skema `attendance` inti.

## 2. Arsitektur & Komponen

App `apps/absensi` (Next.js, Tailwind v4, `@suka/design-system`). Struktur dirapikan ke **folder per-fitur** untuk skalabilitas & batas yang jelas.

```
apps/absensi/src/
├── app/
│   ├── login/                 (tetap; poles ikon)
│   ├── dashboard/             → Papan Kehadiran Hari Ini
│   ├── clock/                 → kiosk: auto-identify + liveness + state pintar
│   ├── enroll/                (poles; konsisten gaya kiosk)
│   └── rekap/                 → rekap + ringkasan + export
├── features/
│   ├── clock/                 hook & komponen layar absensi (kiosk state machine)
│   ├── board/                 query + komponen Papan Kehadiran
│   └── rekap/                 query + ringkasan + export CSV/PDF
├── lib/
│   ├── face/
│   │   ├── recognizer.ts      (ada) load model + extractDescriptor
│   │   ├── match.ts           (ada) isMatch / averageDescriptors
│   │   ├── identify.ts        (BARU) FaceMatcher 1:N dari descriptor staff
│   │   └── liveness.ts        (BARU) deteksi aksi acak dari landmark (kedip/toleh/angguk)
│   ├── attendance/            (ada) submit + queue + types (types: GPS opsional)
│   ├── feedback/              (BARU) toast store + bunyi (Web Audio)
│   └── supabase.ts            (ada)
└── components/                Navbar (ikon), CameraCapture (ada), dst.
```

Design-system (`packages/design-system`) menambah primitif kecil: `StatusPill`, `Avatar`, `EmptyState`, `Spinner`, plus `Toast` di app-level (atau DS bila reusable lintas-app).

| Unit | Tugas | Bergantung pada |
|------|-------|-----------------|
| `lib/face/identify` | bangun `FaceMatcher` dari descriptor staff outlet; cocokkan wajah live 1:N → kembalikan staff + jarak | face-api.js, cache descriptor |
| `lib/face/liveness` | pilih 1 tantangan acak; deteksi lulus dari urutan landmark antar-frame (EAR untuk kedip; pergeseran posisi hidung relatif kotak wajah untuk toleh/angguk) | face-api.js landmark (sudah dimuat) |
| `features/clock` | state machine kiosk: idle → identify → liveness → capture → submit → result; integrasi state pintar IN/OUT | `lib/face/*`, `lib/attendance`, `lib/feedback` |
| `features/board` | query absensi hari ini per outlet, hitung hadir/telat/belum/keluar | `lib/supabase`, `outlet_staff`, `attendance` |
| `features/rekap` | query per tanggal, hitung ringkasan (tepat/telat/alpha), generate CSV/PDF, spot-check selfie | `lib/supabase` |
| `lib/feedback` | toast queue + bunyi sukses/gagal (Web Audio oscillator, tanpa aset) | — |

## 3. Perubahan per Layar

### 3.1 `/clock` — kiosk absensi (perubahan terbesar)
State machine (satu layar, transisi otomatis):

```
IDLE         → kamera live; deteksi wajah berkala
IDENTIFY     → wajah terdeteksi → FaceMatcher 1:N
                 tak dikenali / jarak ≥ ambang → "Wajah belum dikenali" (kembali IDLE)
                 dikenali → tampilkan "Halo, <Nama>"; cek state hari ini → tentukan IN/OUT
LIVENESS     → pilih 1 aksi acak (kedip/toleh/angguk); tampilkan instruksi + countdown ~5s
                 gagal/timeout → ulang aksi acak baru (maks N coba) → batal ke IDLE
                 lulus → lanjut
CAPTURE      → ambil selfie frame; upload Storage selfies/<outlet_id>/<uuid>.jpg
SUBMIT       → payload (TANPA gps) → online: Edge Function; offline: queue IndexedDB
RESULT       → toast + bunyi: "Clock-in/out berhasil · <jam> · <status>"; auto-reset ke IDLE
```

- **Tanpa pilih nama, tanpa GPS, tanpa tap berlebih.** Operator hanya menghadap kamera + 1 aksi.
- **State pintar:** belum ada record `in` hari ini → tombol/aksi = Clock-IN; sudah `in`, belum `out` → Clock-OUT; sudah keduanya → info "sudah lengkap" (boleh catat tambahan, ditandai anomali di rekap).
- **Fallback ramah:** tak dikenali 3x → tampilkan tombol manual "Pilih nama" (alur 1:1 lama) sebagai jaring pengaman, bukan jalur utama.

### 3.2 `/dashboard` — Papan Kehadiran Hari Ini
- 4 metric card: Hadir, Telat, Belum hadir, Total staff.
- Daftar staff + `StatusPill`: Masuk `<jam>` / Telat `<jam>` / Belum hadir / Keluar `<jam>`.
- Query: `outlet_staff` aktif outlet ini ⟕ `attendance` hari ini; hitung status. Auto-refresh ringan (interval/realtime opsional, default polling saat fokus).
- Mengganti dashboard placeholder M0 (checklist) sepenuhnya.

### 3.3 `/rekap` — rekap + ringkasan + export
- Filter tanggal (sudah ada) + ringkasan 3 angka (Tepat/Telat/Alpha).
- Baris: thumbnail selfie (klik → preview besar untuk spot-check), nama, tipe (IN/OUT, ikon), jam, selisih `ts_client` vs `ts_server` bila offline, `StatusPill`.
- **Export CSV** (kontrak data pertama untuk integrasi/payroll) + **Export PDF** (cetak harian). Generate client-side.

### 3.4 `/enroll` — poles
- Ikon menggantikan emoji; gaya capture konsisten kiosk; consent biometrik UU PDP tetap (wajib sebelum kamera).

### 3.5 Navbar & global
- Ikon `lucide-react` (Absensi/Enroll/Rekap/Dashboard, logout); hapus 🥙 brand emoji → wordmark/ikon.
- `Toast` provider global + util bunyi.

## 4. Hapus GPS — dampak lintas-lapis

| Lokasi | Perubahan |
|--------|-----------|
| `app/clock/page.tsx` | hapus blok `navigator.geolocation.getCurrentPosition`; tak set `gps_lat/lng` |
| `lib/attendance/types.ts` | `gps_lat`/`gps_lng` → opsional (`number \| null`/dihilangkan dari payload wajib) |
| `lib/gps.ts` | tidak dipakai alur absen; boleh disisakan (util haversine) tapi lepas dari `/clock` |
| Edge Function `submit-attendance` | buang validasi `invalid_gps`; buang fetch `outlets.lat/lng` & `radius_m`; buang cabang `outside_radius`; insert `gps_*`/`distance_m` = null |
| `supabase/functions/_shared/haversine.ts` | tak lagi dipanggil submit-attendance (boleh tetap ada untuk modul lain) |
| `outlet_attendance_config` | `radius_m` jadi tak terpakai (biarkan kolom; tak ada migration destruktif) |
| DB `attendance` | kolom `gps_lat/gps_lng/distance_m` tetap (nullable) untuk kompatibilitas histori |

Edge Function tetap **server-authoritative** untuk: validasi JWT/role, kepemilikan outlet, enroll-check, validasi path selfie, stempel `ts_server`, penentuan `status`, insert idempoten. Hanya lapisan radius yang hilang.

## 5. Liveness — kontrak deteksi

Tujuan: anti foto/video rekaman dengan friksi minimal. **Hanya pakai landmark 68 yang sudah dimuat** (tanpa model expression tambahan).

- **Tantangan acak** dipilih saat masuk state LIVENESS: `blink` | `turn` (kiri/kanan acak) | `nod`.
- **blink:** Eye-Aspect-Ratio (EAR) dari 6 titik tiap mata; deteksi transisi terbuka→tertutup→terbuka dalam jendela waktu.
- **turn:** posisi-x ujung hidung relatif lebar kotak wajah bergeser melewati ambang ke arah diminta, lalu kembali.
- **nod:** posisi-y ujung hidung relatif tinggi kotak wajah bergeser turun-naik melewati ambang.
- **Timeout** ~5s; gagal → pilih aksi acak baru; maksimum 3 percobaan → batal (kembali IDLE).
- `match_distance` (jarak face) tetap dikirim untuk audit; tidak ada data biometrik mentah ke server.
- **Threat model diterima:** liveness ini bukan anti-deepfake. Cukup untuk titip-absen praktis di outlet (foto HP/cetak/video pendek) karena aksi acak tak bisa diprediksi. Selfie audit menutup sisanya.

## 6. Performa & Skalabilitas

- **Ringan/cepat:** hapus tunggu izin GPS; liveness gratis dari model yang sudah ada; descriptor di-cache (IndexedDB); model face-api lazy-load saat layar kamera; ikon tree-shaken (`lucide-react` per-ikon).
- **Skalabilitas/integrasi:** folder per-fitur dengan batas jelas; satu `attendanceService` bertipe sebagai pintu baca/tulis (titik integrasi sistem lain/payroll); export CSV = kontrak data pertama; tak ada perubahan skema yang mengunci arah integrasi.

## 7. Error Handling & Edge Cases

| Situasi | Penanganan |
|---------|-----------|
| Izin kamera ditolak | Blokir; instruksi aktifkan kamera (banner ikon) |
| Wajah tak terdeteksi | Panduan posisi; tak lanjut |
| Tak dikenali (1:N) | "Wajah belum dikenali"; 3x → tawarkan fallback "Pilih nama" (1:1) |
| Liveness gagal/timeout | Ulang aksi acak baru; 3x → batal ke IDLE |
| Sudah IN & OUT hari ini | Info "sudah lengkap"; catat tambahan ditandai anomali di rekap |
| Offline saat absen | Queue IndexedDB + selfie blob; badge "x menunggu sync" |
| Sync gantung/5xx | Tetap di antrian, retry backoff |
| Dobel tekan/replay | `ON CONFLICT(id) DO NOTHING` (idempoten) |
| Model gagal load | Banner; kiosk disabled sampai siap (online-first) |
| Sesi outlet kedaluwarsa | Redirect login; antrian offline aman |

## 8. Testing

**Unit (Vitest):**
- `lib/face/identify`: descriptor cocok → staff benar; wajah asing → null/≥ambang.
- `lib/face/liveness`: urutan landmark sintetis untuk blink/turn/nod → lulus; statis → gagal; timeout → gagal.
- `features/rekap` export: baris → CSV terformat benar (escaping, header).
- `features/board`: join staff×attendance → hitung hadir/telat/belum/keluar benar.

**Edge Function (Deno test):** revisi test lama yang mengandalkan radius → hapus cabang `outside_radius`/`invalid_gps`; pastikan submit tanpa `gps_*` tetap sukses; role/cross-outlet/enroll/idempotency tetap lulus.

**Manual/E2E:** enroll → hadap kamera dikenali → liveness acak lulus → IN tercatat; wajah lain via foto → liveness gagal → ditolak; offline tersimpan & sinkron; Papan Kehadiran akurat; export CSV terbuka di spreadsheet.

## 9. Out of Scope (ditunda)
- PIN cadangan bila wajah gagal.
- Liveness pasif berbasis model ML tambahan / anti-deepfake.
- Realtime push penuh untuk Papan Kehadiran (mulai polling-on-focus).
- Payroll/penggajian, rotasi shift.
- Component library besar di design-system.
