# Design: Rombak `e2e_network_detailed.html` (Approach B — Dashboard Shell)

**Tanggal:** 2026-07-10
**Status:** Disetujui (brainstorming)
**File utama:** `docs/interactive-diagrams/e2e_network_detailed.html`
**Cakupan tambahan:** koreksi fakta menyebar ke `e2e_network.html`, `e2e_swimlane.html`, `e2e_macro.html`, dan `docs/FLOWS.md #3`.

---

## 1. Tujuan

Merombak peta jaringan E2E "4-Dimensi" agar (a) **bebas bug render**, (b) **akurat terhadap kode nyata** yang sudah dikerjakan, dan (c) punya **panel detail teknis yang komprehensif** per node. Boleh mengubah desain (disepakati Approach B: dashboard shell).

Prinsip pemandu: papan besar harus **kebaca cepat** — pengguna bisa mengisolasi salah satu dari 4 aliran (Data / Uang / Barang / Dokumen) dalam sekejap.

---

## 2. Masalah pada versi saat ini (hasil analisis)

### 2.1 Bug render (nyata, aktif sekarang)
- `FaceMatch`, `LivenessCheck`, `OfflineQueue` memakai `:::absen` — **tidak ada `classDef absen`** → node tampil tanpa gaya.
- Baris `click GPSCheck call showDetails("GPSCheck")` menunjuk **node yang tidak ada** (handler mati); `nodeData` juga tak punya `GPSCheck`.

### 2.2 Drift fakta vs kode (`apps/absensi/src/lib/face`)
| Diagram (lama) | Kode nyata |
|---|---|
| `face-api.js` | **`@vladmandic/human`** |
| "Euclidean Distance < 0.5" | **cosine similarity ≥ `0.65`** (`DEFAULT_MATCH_THRESHOLD`), sengaja pindah dari euclidean |
| `apps/absensi/src/app/clock/page.tsx` | **`apps/absensi/src/app/kiosk/[outlet_id]/page.tsx`** + `features/clock/AttendanceKioskPanel.tsx` |
| "Bebas GPS / GPS diganti Liveness" | `src/lib/gps.ts` **masih ada** & dipakai di `api/submit-attendance/route.ts` + kiosk panel |

**Keputusan pemilik (brainstorming):** alur anti-curang = **GPS + Liveness dua-duanya aktif**. Urutan clock-in benar:
`ClockIn → 📸 Capture → FaceMatch (cosine ≥ 0.65) → GPSCheck (radius outlet) → LivenessCheck (challenge) → AttendanceDB`, dengan cabang gagal-koneksi → `OfflineQueue → (online) → AttendanceDB`.

### 2.3 Gap desain
- Tidak ada pan/zoom pada graf raksasa (padahal spec View 2 mensyaratkannya).
- Legenda 4-dimensi terkubur di satu baris intro.
- Tak bisa mengisolasi satu aliran.
- Panel detail minim (hanya app/role/desc/integrasi).

---

## 3. Arsitektur solusi (Approach B: Dashboard Shell)

Single-file HTML. Stack: **Tailwind (CDN) + Mermaid 10 (ESM) + `svg-pan-zoom` (CDN) + vanilla JS**. Tanpa build step. Semua state di memori (tanpa backend).

Tiga kolom:

### 3.1 Rail kiri (~260px)
- Judul + subjudul.
- **Legenda warna node = app** (8 kelas: auth, portal/absensi, pos, stok, distribusi, admin, owner, finance, external).
- **Legenda 4 aliran:** Data (`===` abu tebal) · Uang (`$` hijau tebal dash) · Barang (`📦` amber tebal) · Dokumen (`📄` abu putus-putus).
- **4 tombol filter aliran** (toggle: sorot satu, redupkan sisanya) + tombol **"Tampilkan Semua"**.
- Toggle **"Sorot batas lintas-app"** (menebalkan cross-edges).

### 3.2 Kanvas tengah
- Graf Mermaid di dalam wrapper `svg-pan-zoom` (drag-to-pan, scroll-zoom).
- Kontrol **zoom in / out / reset**.
- **Search node**: input teks → node yang cocok di-highlight (outline) + buka panel detailnya.

### 3.3 Drawer kanan (~400px)
- Panel detail komprehensif (skema §4).
- Tombol tutup.
- Daftar **node terkait** sebagai tombol (klik → buka panel node itu, sekaligus highlight di kanvas).

---

## 4. Skema panel detail (per node)

Objek `nodeData[id]` diperluas menjadi:

```js
{
  app: string,          // "Absensi (M1)"
  color: string,        // kelas warna teks tailwind
  role: string,         // aktor/pelaku
  status: "live" | "dev" | "external",   // badge 🟢/🟡/⚪
  description: string,  // deskripsi teknis panjang (boleh HTML)
  inflow: string,       // apa yang masuk ke node ini (dari mana)
  outflow: string,      // apa yang keluar (ke mana)
  dbObjects: string[],  // tabel/RPC/trigger/view/migration nyata
  codePath: string | null, // path file kode nyata
  refs: string[],       // ADR/doc/sesi rujukan
  related: string[]     // id node terkait (jadi tombol lompat)
}
```

Render drawer menampilkan semua field; field kosong disembunyikan. `related` dirender sebagai tombol yang memanggil `showDetails(id)`.

**Basis fakta untuk pengisian** (dari CLAUDE.md + kode): `ledger_stok`, `stok_balance`, `trg_process_bom_stok`, `ledger_stamp_saldo` (atomik, SECURITY DEFINER, guard no-negative), `fill_harga_snapshot` (ADR-011 snapshot harga di Surat Jalan), `monitoring_view_spv`, `sales_summary_spv`/`sales_hourly_spv`, `accessible_outlet_ids()` (scope leader/mitra), `outlet_attendance_config.absen_window_mode`, `@vladmandic/human` v3.3.6, cosine `0.65`, kiosk `app/kiosk/[outlet_id]`.

---

## 5. Mekanisme filter 4-aliran (paling rewel)

Mermaid tak memberi kelas andal ke tiap edge. Strategi **pasca-render**:
1. Setelah `mermaid.run()` selesai, pindai semua `.edgeLabels .edgeLabel` untuk teks label.
2. Klasifikasi tiap edge dari isi labelnya: mengandung `$` → `money`; `📦` → `goods`; `📄` → `doc`; selain itu → `data`.
3. Pasangkan indeks label ke `.edgePaths > path` pada indeks yang sama; tempel `data-flow` + kelas CSS.
4. Tombol filter menyetel opacity edge di luar aliran terpilih menjadi redup (mis. `0.08`) dan menonjolkan yang terpilih.

**Ketahanan:** jika struktur SVG Mermaid berbeda dari asumsi (pasangan label↔path tak ketemu), fungsi **no-op tanpa error** (filter sekadar tak berefek), graf tetap tampil normal.

---

## 6. Konten graf terkoreksi (ringkas)

- `classDef absen` ditambahkan; node absensi memakainya.
- Node baru: **`GPSCheck`** (radius outlet, aktif) dan **`ChecklistBuka`** (gerbang buka toko) → edge ke `POS_Sales` berlabel "Syarat buka kasir".
- Handler `click` mati dibuang; semua `click` menunjuk node yang ada.
- Label wajah dikoreksi ("cosine ≥ 0.65", "@vladmandic/human").
- `SuratJalan` dipertegas memicu `fill_harga_snapshot` (ADR-011).

Node lain (POS, Stok, Distribusi, Finance M5, Admin, Owner) dipertahankan, hanya panel detailnya diperkaya. Finance/Treasury tetap ditandai 🟡 Dev dengan angka rupiah sebagai **ilustrasi skenario**, bukan data nyata.

---

## 7. Koreksi menyebar (sibling + FLOWS.md)

- `e2e_network.html`, `e2e_swimlane.html`, `e2e_macro.html`: koreksi lib wajah, threshold/metrik, path kiosk, dan tampilkan **GPS + Liveness dua-duanya**.
- `FLOWS.md #3` (clock-in): sudah menampilkan cek radius GPS (benar) — sinkronkan metrik wajah (cosine `0.65`, `@vladmandic/human`) dan **tambah langkah Liveness challenge setelah GPS** agar konsisten dengan peta.

---

## 8. Non-tujuan (YAGNI)

- Tidak membangun backend / persistensi.
- Tidak menyentuh kode aplikasi (`apps/*`) — hanya dokumen/diagram.
- Tidak menghapus `gps.ts` (GPS dinyatakan masih aktif).
- Tidak menambah build tooling; tetap file HTML statis buka-langsung.

---

## 9. Verifikasi

- Buka file di browser: graf render tanpa node tak-bergaya, tanpa error konsol Mermaid.
- Klik beberapa node lintas app → panel detail lengkap muncul; tombol node-terkait berpindah.
- Uji 4 tombol filter → hanya aliran terpilih menonjol.
- Pan/zoom + search node berfungsi.
- Cek silang: klaim wajah/threshold/path di keempat HTML + FLOWS.md konsisten dengan `apps/absensi/src/lib/face/match.ts` dan `app/kiosk/[outlet_id]`.
