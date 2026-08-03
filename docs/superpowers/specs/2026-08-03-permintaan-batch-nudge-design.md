# Nudge Kirim Batch — Permintaan Bahan Baku — Design

**Tanggal:** 2026-08-03
**Status:** Disetujui untuk bagian "Nudge Batch" (§3). Bagian §5 (item nyangkut tanpa batas waktu) **BELUM diputuskan** — lihat gerbang keputusan di §5.
**Cakupan:** `apps/stok/src/components/permintaan/PermintaanForm.tsx` — satu file, murni UI lapisan submit, tanpa perubahan database.

---

## 1. Masalah & bukti

Form permintaan bahan baku (outlet → Gudang Pusat) punya mekanisme yang **disengaja dan benar**: bahan yang masih punya permintaan berstatus `menunggu` disembunyikan dari pilihan (`pendingItemIds`, `PermintaanForm.tsx:33-37`), supaya tidak ada dua permintaan aktif untuk bahan yang sama.

Ditemukan di lapangan: crew di beberapa outlet mengirim permintaan **satu bahan per kali**, berulang-ulang, alih-alih mengumpulkan beberapa bahan dulu baru kirim sekali. Bukti dari ledger (`permintaan_bahan` + `permintaan_bahan_item`, dicek 2026-08-03):

```
SUKA SHAWARMA CIMANGGU — 8 permintaan terpisah, masing-masing 1 item, dalam 3 menit:
  15:48:34 → 15:49:50 (+76s) → 15:50:07 (+17s) → 15:50:26 (+19s) → 15:50:39 (+13s)
  → 15:50:56 (+17s) → 15:51:11 (+15s) → 15:51:28 (+17s) → 15:51:42 (+14s)

MITRA PALEDANG — pola sama, termasuk 3 permintaan dalam <1 menit (16:37:20-16:38:08)
```

Akibatnya: karena mekanisme hide bekerja per-bahan tanpa syarat waktu, setiap kali crew kirim satu bahan, bahan itu langsung hilang dari layar mereka sendiri. Setelah 8-9 kali, sebagian besar daftar bahan outlet itu lenyap dari pilihan — situasi yang **memperkuat dirinya sendiri**: makin sering kirim satu-satu, makin sedikit yang bisa dipilih untuk dikumpulkan jadi satu permintaan berikutnya.

Backlog nyata per 2026-08-03 (permintaan `status='menunggu'`, belum diproses admin_kitchen):

| Outlet | Jumlah menunggu | Tertua sejak |
|---|---|---|
| SUKA SHAWARMA CIMANGGU | 9 | 2026-08-01 15:48 |
| MITRA PALEDANG | 9 | 2026-08-01 14:59 |
| MITRA CICURUG | 6 | 2026-08-02 14:48 |
| MITRA CIBINONG | 5 | 2026-08-02 15:39 |
| SUKA SHAWARMA EMPANG | 5 | 2026-08-01 16:01 |

## 2. Alur yang sudah ada (konteks penting sebelum desain)

Form ini **bukan** submit-langsung-dari-katalog. Alurnya sudah dua langkah:

1. **Katalog** — pilih target menu (dihitung BOM otomatis) dan/atau tambah manual dari "Saran Item Kritis" / dropdown pencarian → masuk ke `manualBahan`/`menuTargets`.
2. **Tombol keranjang mengambang** muncul begitu ada ≥1 item (`cartItemCount > 0`).
3. **Layar "Tinjau Permintaan"** (`isCartView === true`) — daftar `finalCart`, baru di sini ada tombol **"Kirim N Permintaan"** yang memanggil `submit()`.

Jadi titik intervensi satu-satunya yang pasti dilewati semua jalur: **tombol "Kirim" di layar Tinjau Permintaan**, tepat sebelum `submit()` dipanggil.

Root cause pola satu-per-satu: daftar "Saran Item Kritis" (`PermintaanForm.tsx:482-513`) menyaring keluar bahan yang sudah masuk `manualBahan` — begitu satu bahan di-"+ Tambah", ia hilang dari daftar saran dan daftar mengecil, terasa seperti "satu tugas selesai", mendorong buru-buru cek-keranjang-kirim alih-alih lanjut menambah bahan lain dulu.

## 3. Keputusan desain — Nudge Batch

### 3.1 Pemicu

Muncul saat tombol "Kirim" ditekan, **jika DAN HANYA JIKA**:
```
finalCart.length === 1  AND  pendingItemIds.size > 0
```

Bukan sekadar "keranjang cuma 1 item" (itu bisa jadi memang cuma butuh 1 bahan hari itu — wajar, tidak perlu ditegur). Dipersempit ke kondisi yang benar-benar terjadi di lapangan: **mau kirim lagi padahal permintaan lain masih menumpuk menunggu**.

### 3.2 Isi dialog

```
⏳ Masih ada permintaan yang menunggu

Anda punya {pendingItemIds.size} item bahan baku lain yang
masih menunggu persetujuan admin_kitchen. Mau kirim yang ini
sekarang, atau kembali dulu untuk gabungkan dengan bahan lain?

[ Kembali, Tambah Dulu ]   [ Kirim Sekarang ]
```

Catatan koreksi istilah: persetujuan permintaan bahan adalah wewenang **admin_kitchen** (`canApprovePermintaan` di `apps/stok/src/lib/stok/approver.ts` → `['kitchen', 'admin', 'owner']`), **bukan SPV** — SPV/leader cuma mengawasi. Banner yang sudah ada di layar katalog (`PermintaanForm.tsx:352-355`) saat ini salah sebut "menunggu persetujuan SPV" — **perbaiki juga teks itu** jadi "admin_kitchen" di task yang sama, supaya konsisten dengan dialog baru (murni ganti 1 baris teks, tidak mengubah logika).

Angka `{pendingItemIds.size}` ditampilkan konkret (bukan "beberapa"), supaya terasa nyata seperti kondisi Cimanggu/Paledang.

### 3.3 Alur interaksi

State baru: `showBatchNudge: boolean`.

Tombol "Kirim N Permintaan" (`PermintaanForm.tsx:336-342`) diubah `onClick`-nya:
```ts
onClick={() => {
  if (finalCart.length === 1 && pendingItemIds.size > 0) {
    setShowBatchNudge(true)
  } else {
    submit()
  }
}}
```

Dialog dirender sebagai overlay kecil **di atas** layar Tinjau Permintaan yang sedang tampil (bukan modal terpisah/route lain) — supaya konteks keranjang tetap kelihatan di belakang.

- **"Kembali, Tambah Dulu"** → `setShowBatchNudge(false)` lalu `setIsCartView(false)`. Item yang sudah ada di `manualBahan`/`menuTargets` **tetap tersimpan** (state tidak direset) — pengguna kembali ke katalog untuk melanjutkan menambah, bukan mulai dari nol.
- **"Kirim Sekarang"** → `setShowBatchNudge(false)` lalu panggil `submit()` — jalan seperti biasa, tidak ada penghalang kedua. Dialog ini murni nudge sekali tampil, bukan gerbang wajib.

### 3.4 Kasus tepi

- Selama `busy === true` (proses kirim berjalan), tombol "Kirim" tetap `disabled` seperti sekarang — dialog tidak boleh terpicu ulang di tengah proses.
- Kalau `pendingItemIds.size` berubah (realtime) **selagi dialog terbuka** (mis. request lain baru saja disetujui), biarkan saja — tidak perlu re-check kondisi; hormati keputusan pengguna atas apa yang mereka lihat saat dialog dibuka.
- `showBatchNudge` di-reset ke `false` setiap kali `submit()` berhasil (dalam blok yang sama dengan `setMenuTargets({}); setManualBahan({}); setIsCartView(false)` di `PermintaanForm.tsx:200-202`).

## 4. Cakupan implementasi

**File yang diubah:** `apps/stok/src/components/permintaan/PermintaanForm.tsx` — satu file.
- Tambah state `showBatchNudge`.
- Ubah `onClick` tombol kirim (baris ~338).
- Tambah render overlay dialog (kondisional, di dalam blok `isCartView`).
- Perbaiki teks banner baris 353-354: "SPV" → "admin_kitchen".

Tidak ada perubahan database, migration, hook (`usePermintaan.ts`), atau server action.

**Testing:** `apps/stok` saat ini cuma punya 1 file test (`compositeUnit.test.ts`, fungsi murni). Komponen ini bergantung berat pada hooks Supabase (`useSaranItem`, `usePermintaanList`, dll) tanpa infrastruktur mock yang ada — unit test React **di luar cakupan** perubahan kecil ini. Verifikasi via **smoke test manual di browser**: simulasikan kondisi (1 item di keranjang + ada baris `pendingItemIds`), pastikan dialog muncul dan kedua tombol berfungsi sesuai §3.3.

## 5. GERBANG KEPUTUSAN — belum disetujui, jangan diimplementasikan tanpa jawaban user

Saat brainstorming, ditemukan konsekuensi dari mekanisme hide yang sudah ada (bukan bagian dari nudge di atas, ditemukan lewat pertanyaan user):

**`pendingItemIds` tidak punya batas waktu.** Kalau AYAM diminta hari ini dan belum di-acc admin_kitchen, maka AYAM **tetap hilang** dari semua jalur pemilihan (manual, saran kritis, bahkan kalkulasi BOM dari target menu) — **berapa lama pun** request lama itu mengendap, sampai admin_kitchen approve atau tolak. Tidak ada jalan keluar di form ini untuk kasus "sudah lama menunggu, dan sekarang genuinely kehabisan/darurat".

Dengan backlog nyata 2+ hari di beberapa outlet (§1), ini bukan skenario hipotetis — outlet bisa benar-benar terhalang meminta bahan yang sedang kritis, kalau kebetulan bahan itu nyangkut di permintaan lama.

**User belum memutuskan** apakah ini:
- (a) digarap sebagai bagian dari task yang sama (mis. tambah batas waktu — kalau sudah menunggu >X jam, boleh diminta ulang dengan peringatan/label khusus), atau
- (b) desain & implementasi terpisah, dikerjakan setelah nudge batch ini selesai.

**Jangan kerjakan §5 tanpa konfirmasi eksplisit dari user.** Kalau sesi berikutnya melanjutkan dokumen ini, ajukan pertanyaan itu dulu sebelum menulis kode untuk bagian ini.
