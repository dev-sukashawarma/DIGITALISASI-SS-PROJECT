# Panduan Sistem — Konten Absensi (baru) + Perbaikan Kasir (design)

**Status:** Approved. **Tanggal:** 2026-07-07.

## Latar Belakang

Admin-dashboard punya CMS "Kelola Panduan" (`/dashboard/panduan/[system_code]`) yang menyimpan
tiap topik panduan sebagai satu baris di tabel `system_guides` (`system_code`, `category` = nama
bab, `title`, `content_html`, `sort_order`, `image_url`). Panduan sudah dibaca lewat viewer publik
di masing-masing app (mis. `/panduan` di pos-kasir).

Dicek langsung ke database (read-only, service role):

| `system_code` | Kondisi saat ini |
|---|---|
| `pos` (Kasir) | Lengkap: 8 bab, 18 topik, tiap topik sudah ada `content_html` nyata (~100-200 kata) sesuai fitur asli. |
| `absensi` | 1 baris placeholder, judul literal `"test"`. Belum ada isi. |
| `stok` | 1 baris generik (draft lama, 3 kalimat). |
| `distribusi` | 1 baris generik (draft lama, 3 kalimat). |

User memilih fokus sesi ini: **(1)** melengkapi kekurangan `pos`, **(2)** membangun `absensi` dari
nol. `stok` dan `distribusi` di luar cakupan sesi ini.

## Temuan Real-Case (verifikasi kode, bukan asumsi)

**`pos` (apps/pos-kasir) — 2 celah nyata:**
1. **Void/batalkan pesanan** ([app/kasir/page.tsx:227-243](../../apps/pos-kasir/app/kasir/page.tsx#L227)) —
   perlu **PIN otorisasi SPV/Leader** lalu **alasan pembatalan wajib diisi**. Fitur ini sama sekali
   belum punya topik panduan.
2. **Buka/Tutup Shift** ([app/kasir/shift/page.tsx](../../apps/pos-kasir/app/kasir/shift/page.tsx)) —
   menu sidebar "Petty Cash" sebenarnya menu gabungan Shift + Petty Cash. Bab 4 saat ini cuma
   menjelaskan sisi uang (laci & dana operasional), tapi tidak menjelaskan **membuka shift**
   (isi setoran awal dana operasional) maupun **blind close** (hitung fisik manual vs
   perhitungan sistem otomatis, lihat selisih "Lebih/Kurang dari sistem").

**`absensi` (apps/absensi)** — fitur nyata per route (`src/app/dashboard/*`, `src/app/kiosk/*`):
login, kiosk absen wajah (liveness 2-fase: gerakan kepala → kembali frontal → verifikasi),
cuti (`CutiView` — jenis: tahunan/sakit/unpaid/melahirkan/lainnya, kuota, riwayat), kasbon
(`KasbonView` — nominal, skema cicilan 1-6 bulan, riwayat), rekap kehadiran, checklist harian,
manajemen kru (buat akun crew/kasir/spv/leader), enrollment wajah (SPV/leader-only, 3 frame
frontal), papan kehadiran real-time (SPV), pengaturan mode absensi auto/manual per outlet.

## Rencana Konten

### A. Perbaikan `pos` — tambah 3 topik, retitle 1 bab

| Bab (category) | Topik (title) | sort_order | Aksi |
|---|---|---|---|
| Bab 2 · Order & Pesanan | Membatalkan Pesanan (Void) | 5 | **INSERT** baru |
| Bab 4 · **Shift & Petty Cash** (rename dari "Bab 4 · Petty Cash") | Membuka Shift (Setoran Awal) | 1 | **INSERT** baru |
| Bab 4 · Shift & Petty Cash | Memahami Laci Kasir & Dana Operasional | 2 | **UPDATE** category + sort_order saja (content_html & image_url existing tidak disentuh) |
| Bab 4 · Shift & Petty Cash | Mencatat Pengeluaran & Mengajukan Top Up | 3 | **UPDATE** category + sort_order saja (content_html & image_url existing tidak disentuh) |
| Bab 4 · Shift & Petty Cash | Menutup Shift (Blind Close) & Selisih Kas | 4 | **INSERT** baru |

18 topik lain di bab 1, 2 (4 lama), 3, 5-8 tidak disentuh sama sekali.

### B. `absensi` — bangun baru, 7 bab / ~15 topik

| Bab (category) | Topik | sort_order |
|---|---|---|
| Bab 1 · Mengenal Sistem | Apa Itu Sistem Absensi Ini? | 1 |
| Bab 1 · Mengenal Sistem | Cara Masuk (Login) | 2 |
| Bab 2 · Absen di Kiosk (Face Recognition) | Cara Absen Masuk & Pulang Lewat Kamera | 1 |
| Bab 2 · Absen di Kiosk (Face Recognition) | Kenapa Wajah Saya Ditolak? | 2 |
| Bab 3 · Cuti & Izin | Mengajukan Cuti / Izin | 1 |
| Bab 3 · Cuti & Izin | Melihat Status & Sisa Kuota Cuti | 2 |
| Bab 4 · Kasbon | Mengajukan Kasbon & Skema Cicilan | 1 |
| Bab 4 · Kasbon | Melihat Riwayat & Status Kasbon | 2 |
| Bab 5 · Kehadiran Saya | Melihat Rekap Kehadiran | 1 |
| Bab 5 · Kehadiran Saya | Checklist Tugas Harian | 2 |
| Bab 6 · Untuk SPV/Leader — Kelola Kru | Membuat Akun Kru Baru | 1 |
| Bab 6 · Untuk SPV/Leader — Kelola Kru | Mendaftarkan Wajah Kru (Enrollment) | 2 |
| Bab 7 · Untuk SPV/Leader — Monitoring | Papan Kehadiran Real-Time | 1 |
| Bab 7 · Untuk SPV/Leader — Monitoring | Pengaturan Mode Absensi (Otomatis/Manual) | 2 |

Baris placeholder `"test"` (system_code=`absensi`) dihapus sebagai bagian dari seed baru ini.

## Gaya Penulisan

Meniru gaya `pos` yang sudah ada: sapaan "Anda", langkah bernomor untuk prosedur, istilah persis
sama dengan label UI asli (bukan parafrase), 1 heading `<h3>` + 1-2 paragraf/list per topik
(~100-200 kata). **Tidak ada gambar/asset dibuat** — `image_url` dibiarkan `null` di semua baris
baru; user upload sendiri manual lewat tombol "Tambah Gambar" di editor panduan setelah teks live.

## Mekanisme Eksekusi

Script Node sekali-jalan (`scripts/seed-panduan-content-2026-07-07.mjs`, dijalankan dari root
repo, baca kredensial dari `.env.local` tanpa mencetaknya — pola yang sama dengan
`apps/pos-kasir/scripts/seed-panduan-kasir.mjs`):

1. Hapus baris `system_code='absensi' AND title='test'`.
2. Insert 15 baris absensi baru (di atas).
3. Insert 3 baris `pos` baru (void, buka shift, tutup shift).
4. Update 2 baris `pos` existing (Bab 4 lama) → ganti `category` + `sort_order`, **tidak**
   menyentuh `content_html`/`image_url`.
5. Idempotent: pakai `upsert` dengan check "sudah ada judul yang sama di system_code ini?" agar
   aman dijalankan ulang tanpa duplikat.

Tidak ada migration SQL baru — tabel `system_guides` sudah punya semua kolom yang dibutuhkan.
Tidak ada perubahan kode aplikasi (RLS, halaman viewer, editor CMS semua sudah berfungsi).

## Di Luar Cakupan

- `stok` dan `distribusi` (masih generik) — sesi terpisah nanti.
- Pembuatan gambar/screenshot — user upload manual.
- Perubahan skema database atau kode aplikasi.
