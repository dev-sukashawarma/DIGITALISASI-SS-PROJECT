# Admin-Dashboard UX Redesign — Design Doc

**Tanggal:** 2026-07-03
**App:** `apps/admin-dashboard` (dashboard owner/admin/mitra/HR; folder ini = "dashboard owner", bukan `owner-dashboard`)
**Status:** Design disetujui, siap ke rencana implementasi.

---

## 1. Latar & Tujuan

Owner, mitra, admin, dan admin-HR memakai admin-dashboard dari **HP maupun laptop**. Kondisi sekarang terasa kurang ramah untuk orang awam karena empat hal (semua dikonfirmasi user):

1. **Menu kebanyakan / susah cari** — role ADMIN punya ~20 item di 5 grup (`navConfig.ts`).
2. **Halaman padat/sesak** — mis. Untung Rugi menampilkan 7 kartu KPI + chart + tabel berjejalan.
3. **Tampilan kuno / tidak konsisten** — gaya kartu, judul, dan state kosong berbeda antar halaman.
4. **Interaksi lambat/nyangkut** — sebagian sudah diperbaiki (lazy-load recharts di Untung Rugi & Pengeluaran, commit `64e2462`).

**Tujuan:** admin-dashboard yang **sangat mudah dipakai orang awam dan tidak bikin pusing**, responsif di HP & laptop, dengan gaya visual seragam.

**Strategi (dipilih user): big-bang** — rombak shell + semua halaman dalam satu proyek, TAPI dengan pengaman: hanya lapisan presentasi yang berubah; database, hook data, dan aturan akses per-role tidak disentuh.

### Prinsip inti (acuan tiap keputusan)
1. **Sedikit pintu besar, bukan daftar panjang.** Navigasi lewat kartu berlabel jelas, bukan menu 20 baris.
2. **Satu layar = satu tujuan.** Satu aksi/informasi utama; sisanya disembunyikan sampai diperlukan (progressive disclosure).
3. **Bahasa sehari-hari.** Hindari jargon.
4. **Angka penting besar & menonjol.** Maks 3 angka headline per layar.
5. **Seragam total.** Semua kartu/tombol/judul/empty-state/loading satu gaya.

### Non-Goals (YAGNI)
- Tidak mengubah skema database atau membuat migration.
- Tidak mengubah hook data (`useSalesSummary`, `useExpenses`, dll.) atau isi kalkulasi (`lib/profit.ts`).
- Tidak mengubah matriks akses per-role (dipertahankan dari `navConfig.ts`).
- Tidak menyentuh `apps/pos-kasir` & `apps/absensi` (menyusul, proyek terpisah).
- Tidak membangun design-system baru di `packages/design-system` dulu — primitives dibuat lokal di admin-dashboard; nanti bisa diangkat ke package saat merambat ke app lain.

---

## 2. Arsitektur Navigasi Baru — "Hub Berlapis"

Ganti daftar sidebar panjang dengan pola **hub berlapis 3 tingkat**:

```
Tingkat 1: PINTU (4–5 item, di sidebar desktop + bottom-nav mobile)
   └─ Tingkat 2: BERANDA PINTU (halaman berisi kartu-kartu besar per fitur)
        └─ Tingkat 3: HALAMAN FITUR (halaman kerja sebenarnya, sudah ada)
```

Orang awam tidak pernah dihadapkan pada daftar 20 item — maksimal **5 pintu**, lalu **4–5 kartu** di dalam pintu.

### 2.1 Peta pintu per-role

Sumber kebenaran akses tetap pola `roles` di `navConfig`. Item dikelompokkan ulang ke pintu:

**OWNER / MITRA** (business, sering di HP):
| Pintu | Isi (route yang sudah ada) |
|-------|-----------------------------|
| 🏠 Beranda | `/dashboard/owner` (Ringkasan Bisnis) |
| 💰 Untung Rugi | `/dashboard/owner/profit` |
| 🧾 Pengeluaran | `/dashboard/owner/expenses` + `/dashboard/owner/expenses/input` |
| 🎯 Target | `/dashboard/owner/targets` |
| ⋯ Lainnya | `/dashboard/owner/messages` (OWNER saja), `/dashboard/reports/voids`, `/dashboard/reports/shrinkage`, `/dashboard/panduan` |

> MITRA read-only: tidak ada "Pesan ke Kasir", tidak ada input; sesuai `navConfig` grup "Dashboard Mitra" sekarang (4 item). Pintu MITRA = Beranda, Untung Rugi, Pengeluaran, Target.

**ADMIN_HR:**
| Pintu | Isi |
|-------|-----|
| 🏠 Ringkasan | `/dashboard/hr` |
| 👥 Karyawan | `/dashboard/hr/staff` |
| 🕐 Absensi | `/dashboard/hr/attendance` |
| ⋯ Lainnya | `/dashboard/hr/leave` (Cuti), `/dashboard/hr/payroll` (Payroll & Kasbon) |

**ADMIN** (semua akses; 20 fitur → 5 pintu):
| Pintu | Beranda-pintu berisi kartu ke |
|-------|-------------------------------|
| 🏠 Beranda | Hub utama: kartu besar ke tiap pintu + ringkasan singkat |
| 💰 Bisnis | Ringkasan (`/dashboard/owner`), Untung Rugi, Pengeluaran, Input Pengeluaran, Target, Pesan ke Kasir |
| 👥 Karyawan | Ringkasan HR, Database Karyawan, Absensi & Shift, Cuti & Izin, Payroll & Kasbon |
| 📦 Produk & Stok | Master Bahan Baku, Manajemen Resep (BOM), Manajemen Outlet |
| ⋯ Lainnya | Pusat Notifikasi, Void & Fraud, Selisih Stok (shrinkage), Kesehatan Sistem (system-health), Panduan |

### 2.2 Perilaku shell
- **Desktop (≥ md):** sidebar ramping berisi **pintu** (bukan 20 baris). Saat berada di dalam sebuah pintu, sidebar menandai pintu aktif; sub-navigasi antar fitur satu pintu lewat kartu di beranda-pintu dan/atau baris tab tipis di atas konten.
- **Mobile (< md):** bottom-nav berisi 4 pintu utama + tombol "Lainnya" (bottom sheet), pola yang sudah dipakai `BottomNav.tsx` sekarang — dipertahankan & dirapikan.
- **Header:** judul halaman + (bila relevan) filter periode/outlet. Konsisten di semua halaman.
- **Label pintu pakai bahasa awam.** Rename di lapisan tampilan (bukan route): "Profitabilitas"→**Untung Rugi**, "Shrinkage & Opname"→**Selisih Stok**, "System Health"→**Kesehatan Sistem**, "Void & Fraud"→**Pembatalan & Kecurangan**.

### 2.3 Sumber data nav
`navConfig.ts` diperluas jadi struktur pintu (bukan grup datar). Bentuk baru (ilustratif):
```ts
type Door = { key: string; label: string; icon: LucideIcon; roles: Role[]; home: string; items: NavItem[] }
```
Fungsi helper `accessibleDoors(role)`, `doorForPath(pathname)`, `isDoorActive()` menggantikan/menambah `accessibleItems`. `isItemActive` dipertahankan. Uji unit di `navConfig.test.ts` diperbarui (mis. `accessibleDoors('ADMIN')` = 5 pintu, `accessibleDoors('MITRA')` = 4 pintu tanpa Lainnya).

---

## 3. Pola Halaman Standar (mengatasi "padat/sesak")

Setiap halaman fitur mengikuti template konsisten:

```
┌─ PageHeader ── Judul + 1 kalimat penjelas + slot filter (periode/outlet)
├─ Ringkasan ── maksimal 3 StatTile angka BESAR
├─ Isi utama ── SATU chart ATAU satu tabel
└─ Rincian ──── sisanya di dalam <Section> yang bisa dibuka / tab
```

### Contoh penerapan
- **Untung Rugi** (sekarang 7 kartu KPI + chart + tabel): headline = **Omzet · Laba Bersih · Margin**. HPP, Pengeluaran Outlet, Biaya Pusat, Laba Kotor pindah ke Section "Rincian". Chart arus kas (sudah lazy) tetap. Tabel per-outlet: di HP jadi daftar kartu, di desktop tetap tabel.
- **Pengeluaran** (donut + stacked bar + tabel): headline = **Total Pengeluaran Outlet · Biaya Pusat · Kategori teratas**. Dua chart (sudah lazy) di Section terpisah; tabel transaksi jadi kartu di HP.
- **Ringkasan Bisnis** (`owner/page.tsx`): sudah paling matang; sesuaikan ke primitives baru, kurangi kepadatan bila perlu.

### Komponen dasar (dibuat sekali, `src/components/ui/`)
| Komponen | Fungsi |
|----------|--------|
| `PageHeader` | Judul + penjelas + slot filter |
| `StatTile` | Kartu angka besar (label kecil, angka besar, aksen warna, tren opsional) |
| `Card` | Pembungkus putih rounded-2xl + padding konsisten |
| `Section` | Blok berjudul, opsional collapsible ("Lihat rincian") |
| `EmptyState` | Ikon + pesan ramah + tombol aksi |
| `Skeleton` | Kerangka loading berkedip |
| `DataTable` | Tabel yang otomatis jadi daftar kartu di < md |
| `DoorHome` | Grid kartu-besar untuk beranda-pintu (tingkat 2) |

Primitives dipakai ulang di semua halaman → konsistensi otomatis.

---

## 4. Bahasa Visual Seragam

- **Kartu:** putih, `rounded-2xl`, border `suka-gray-200`, padding lega (`p-5`/`p-6`), bayangan halus. Satu ukuran untuk semua.
- **Warna:** aksen `suka-orange` (aktif/utama), `suka-green` (uang positif), merah (negatif). Palet `suka-*` yang sudah ada di Tailwind.
- **Tipografi:** judul `font-extrabold text-suka-brown`; label kecil uppercase abu; angka besar tebal.
- **Uang:** `Rp` + pemisah ribuan; format ringkas untuk angka besar (mis. `Rp 1,2 jt`) via helper `lib/format` yang sudah ada.
- **Empty state ramah:** "Belum ada data. Mulai dengan…" + tombol — bukan layar kosong.
- **Loading = Skeleton**, bukan teks "Memuat…" — persepsi lebih cepat.

---

## 5. Terasa Instan (kecepatan)

- **Lazy-load semua chart recharts** menyeluruh (pola `dynamic(() => import(...), { ssr:false })` yang sudah ada di `RevenueTrendChart`, `ProfitCashFlowChart`, `ExpenseDistributionChart`, `ExpenseTrendChart`). Audit sisa halaman yang meng-import recharts langsung.
- **`optimizePackageImports: ['recharts','lucide-react']`** sudah ada di `next.config.mjs`.
- **Skeleton** saat fetch → terasa responsif.
- **Cache React Query** yang sudah ada (staleTime) dipertahankan; navigasi antar pintu ringan karena halaman tak memuat chunk besar di awal.

---

## 6. Keamanan untuk App Live (big-bang, tapi aman)

- **Tanpa perubahan DB / migration.**
- **Tanpa perubahan hook data / kalkulasi** — hanya presentasi.
- **Akses per-role identik** — sumber tetap `roles` di `navConfig`; hanya pengelompokan tampilan yang berubah. Guard `RoleContext` redirect dipertahankan.
- **Urutan kerja & verifikasi:**
  1. Bangun primitives `src/components/ui/` (+ unit test ringan bila ada logika, mis. `DataTable` breakpoint helper).
  2. Rombak shell: `navConfig` (struktur pintu) → `Sidebar` → `BottomNav` → `Header` → beranda-pintu (`DoorHome`).
  3. Rombak halaman per kelompok pintu (Bisnis → Karyawan → Produk & Stok → Lainnya), pindahkan ke primitives + pola template.
  4. `yarn type-check` + `yarn build` tiap tahap; smoke test via preview per-role (ADMIN, OWNER, MITRA, ADMIN_HR).
- **Catatan pra-ada:** error `ResepEditor.tsx` TS6133 sudah ada sebelumnya (tercatat di CLAUDE.md) — di luar cakupan, jangan dianggap regresi.

---

## 7. Kriteria Sukses

1. Role ADMIN melihat **≤ 5 pintu** di navigasi utama (bukan 20 item datar).
2. Tiap halaman fitur menampilkan **≤ 3 angka headline**; sisanya di Section rincian.
3. Semua halaman memakai primitives yang sama (kartu/judul/empty/loading seragam) — verifikasi visual per halaman.
4. Navigasi HP: bottom-nav 4 pintu + Lainnya; jempol menjangkau, target sentuh ≥ 44px.
5. `type-check` bersih (selain error `ResepEditor` pra-ada) & `build` sukses.
6. Tidak ada perubahan pada file migration / hook data / `lib/profit.ts` / matriks akses.

---

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Big-bang menyentuh banyak file di app live | Presentasi-only; hook & DB tak diubah; build+type-check tiap tahap; kerja per kelompok pintu agar bisa dihentikan/di-review bertahap |
| Regrup nav salah tangkap role | Pertahankan `roles` per item; tambah unit test `accessibleDoors` per role |
| Rename label bikin bingung route | Rename hanya label tampilan, route path tidak berubah |
| Tabel → kartu di HP kehilangan kolom | `DataTable` definisikan kolom prioritas; kolom sekunder tetap tampil di kartu sebagai baris label-nilai |

---

**Artefak lanjut:** rencana implementasi di `docs/superpowers/plans/2026-07-03-admin-dashboard-ux-redesign.md` (dibuat via skill writing-plans).
