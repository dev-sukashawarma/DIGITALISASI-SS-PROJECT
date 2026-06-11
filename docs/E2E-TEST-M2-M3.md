# E2E Test Scenario — M2 Stok + M3 Distribusi (Integrated)

> **Tujuan:** Membuktikan rantai penuh **M3 (kirim barang) → M2 (ledger & stok) → Monitoring** bekerja end-to-end tanpa korupsi data.
> **Tanggal:** 2026-06-11 · **Scope:** 3 outlet pilot (Kitchen, Empang, Paledang/Sukmajaya)
> Centang ✅ / ❌ tiap langkah. Kalau ada ❌ → stop, catat, lihat bagian Troubleshooting.
>
> **Progress:** Fase 0 ✅ · TEST A ✅ · TEST B ✅ · TEST C ✅ · TEST D ✅ (sebagian) · TEST E ⬜ belum. Detail temuan & perbaikan ada di `docs/E2E-RUNBOOK.md`.

---

## 0. Persiapan (lakukan sekali sebelum mulai)

### 0.1 Akun & role yang dipakai

| Peran | Email | Outlet | Dipakai untuk |
|------|-------|--------|----------------|
| **SPV / Kitchen** | spv@test.com | SUKA SHAWARMA KITCHEN | Buat & tanda tangan Surat Jalan |
| **Supir** | (boleh akun SPV, pilih role "Supir" di tanda tangan ke-2) | — | Tanda tangan ke-2 |
| **Crew Empang** | andi.empang@sukashawarma.com | EMPANG | Terima & verifikasi barang |
| **Crew Sukmajaya** | budi.sukmajaya@sukashawarma.com | SUKMAJAYA | Uji isolasi paralel |

### 0.2 Jalankan seed data

Buka Supabase SQL Editor → tempel & jalankan isi **`supabase/seed-e2e-test.sql`**.
Seed ini aman dijalankan berulang (idempotent) dan menetapkan baseline lewat ledger
adjustment (bukan INSERT langsung), supaya saldo tetap konsisten dengan ledger.

**Baseline yang dihasilkan (untuk perbandingan setelah test):**

| Outlet | AYAM | BAWANG | KENTANG | Catatan |
|--------|------|--------|---------|---------|
| EMPANG | **10** | **4** | **8** | sengaja rendah → uji warna monitoring (AYAM reorder 30, BAWANG 5) |
| KITCHEN | 200 | 50 | 50 | stok pengirim |
| PALEDANG | 40 | 8 | 15 | aman |
| SUKMAJAYA | 40 | 8 | 15 | aman (untuk uji isolasi) |

Output query verifikasi di akhir seed harus menampilkan angka di atas, dan **cek
konsistensi saldo harus 0 baris**.

> ⚠️ **Catatan perilaku penting:** RPC `finalize_surat_jalan_and_ledger` saat ini
> **hanya membuat entri ledger untuk item `kondisi='baik'`**. Item yang ditandai
> **Jelek → rusak TIDAK menambah ledger/stok sama sekali** (lihat concern di akhir).
> Skenario B di bawah sengaja menguji ketiga kasus: baik penuh, baik sebagian, dan rusak.

---

## TEST A — M2 Stok berdiri sendiri (opname → ledger → monitoring) — ✅ LULUS (2026-06-11)

**Login: Crew Empang** (`andi.empang@sukashawarma.com` / `test`)

| # | Langkah | Hasil yang diharapkan | ✅/❌ |
|---|---------|-----------------------|-------|
| A1 | Login → dashboard | Outlet ter-set = Empang | ✅ |
| A2 | Buka `/stok/opname/new`, tipe **harian** | Form tampil 15+ bahan, ada filter kategori + search | ✅ |
| A3 | Hitung 5 bahan; buat **3 item selisih >15%** (mis. AYAM jauh dari sistem) | Border item merah, ada warning selisih | ✅ |
| A4 | Klik **Finalisasi Opname** | Redirect ke list, muncul "1 selesai hari ini" | ✅ |
| A5 | Buka `/stok/ledger` | Ada entri `opname_selisih` sebanyak item yang selisih ≠ 0 | ✅ (3 entri) |
| A6 | Klik 1 entri ledger | `saldo_sesudah = saldo_sebelum + qty` (matematika benar) | ✅ |
| A7 | Buka `/stok/monitoring` | Bahan tampil terurut kritis→aman, satuan benar (bukan tebakan) | ✅ (perlu fix SSR client dulu — commit `e8d0636`) |
| A8 | Set 1 bahan qty=0 saat opname lalu finalisasi → cek monitoring | Bahan jadi 🔴 Kritis | ✅ (KENTANG 🔴) |
| A9 | `/stok/monitoring-live` | Kartu outlet tampil, alarm bunyi untuk item kritis | ✅ |

**Manual ledger entry:**

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| A10 | `/stok/ledger/new` → tipe **waste**, qty 2, bahan AYAM | Submit sukses | ✅ |
| A11 | Cek ledger | Entri qty = **-2** (merah) | ✅ |
| A12 | Cek monitoring | Saldo AYAM berkurang 2 | ✅ |

---

## TEST B — M2↔M3 Integrasi: Surat Jalan → Verifikasi → Auto-Ledger (INTI)

Ini bagian terpenting: membuktikan barang yang dikirim Kitchen masuk otomatis ke ledger outlet.

### B1. Buat Surat Jalan — **Login: SPV** (`spv@test.com`) — ✅ LULUS

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| B1.1 | Buka `/distribusi/surat-jalan/new` | Form tampil, bisa pilih outlet tujuan + barang | ✅ |
| B1.2 | Tujuan = **EMPANG**; tambah 3 barang: **AYAM 20**, **BAWANG 5**, **KENTANG 4** | Item masuk daftar | ✅ |
| B1.3 | Submit | Nomor dokumen auto-generate `SJ/KITCHEN/YYYYMMDD/NNN` (SJ/KITCHEN/20260611/0002) | ✅ |
| B1.4 | Buka detail SJ | Status **draft**, nomor & item tampil benar | ✅ |

### B2. Tanda tangan 2 pihak — masih **SPV** — ✅ LULUS

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| B2.1 | Tanda tangan ke-1: role **SPV Kitchen**, gambar di canvas | Tersimpan, muncul thumbnail TT | ✅ |
| B2.2 | Coba submit/kirim dengan 1 TT saja | **Ditolak** — wajib 2 tanda tangan | ✅ |
| B2.3 | Tanda tangan ke-2: pilih role **Supir** | Tersimpan | ✅ |
| B2.4 | Coba tanda tangan canvas kosong | Ditolak (validasi empty) | ✅ |
| B2.5 | Klik **Kirim** (`send_surat_jalan_signed`) | Status → **dikirim** | ✅ |

### B3. Download PDF + QR — ✅ LULUS

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| B3.1 | Download PDF dari list/detail | PDF terbuka, header brand SUKA, tabel item, tabel TT dengan gambar | ✅ |
| B3.2 | Cek QR di PDF (bagian bawah) | QR ada + nomor dokumen di bawahnya | ✅ |
| B3.3 | Scan QR pakai kamera HP biasa | Membuka URL ke halaman terima SJ tsb | ✅ |

### B4. Terima & Verifikasi — **Login: Crew Empang** (`andi.empang@sukashawarma.com`) — ✅ LULUS

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| B4.1 | Buka `/distribusi/terima` | SJ dari Kitchen muncul di daftar masuk | ✅ |
| B4.2 | Klik **Scan QR** → `/distribusi/terima/scan` | Kamera terbuka (atau fallback input manual nomor) | ✅ |
| B4.3 | Scan QR dari B3.2 (atau ketik nomor) | Redirect ke verifikasi SJ yang benar | ✅ |
| B4.4 | Kartu item 1 (AYAM): klik **Baik** | qty_terima = 20, lanjut item berikutnya | ✅ |
| B4.5 | Kartu item 2 (BAWANG): klik **Baik** tapi ubah qty diterima jadi **3** (terima sebagian) | qty_terima = 3, lanjut | ✅ |
| B4.6 | Kartu item 3 (KENTANG): klik **Jelek**, **kosongkan catatan** | Submit ditolak — catatan wajib | ✅ |
| B4.7 | Isi catatan "kentang busuk semua", konfirmasi | Lanjut ke ringkasan | ✅ |
| B4.8 | Layar ringkasan | AYAM Baik 20 · BAWANG Baik 3 · KENTANG Jelek + warning merah | ✅ |
| B4.9 | Klik **Selesai & Simpan Verifikasi** (dengan TTD penerima: Crew Penerima + Supir) | `finalize_surat_jalan_and_ledger` jalan, redirect ke `/distribusi/riwayat` | ✅ |
| B4.10 | Buka detail SJ dari riwayat | Status → **diterima_lengkap**, tampil 4 TTD (2 pengirim + 2 penerima dengan gambar) | ✅ |

### B5. Verifikasi auto-ledger di M2 — **masih Crew Empang** — ✅ LULUS

Baseline Empang dari seed: AYAM=10, BAWANG=4, KENTANG=8.

| # | Langkah | Hasil yang diharapkan | ✅/❌ |
|---|---------|-----------------------|-------|
| B5.1 | Buka `/stok/ledger` Empang | **2** entri `terima_kiriman`: AYAM **+20**, BAWANG **+3**. **KENTANG TIDAK ada** (karena rusak) | ✅ |
| B5.2 | Buka `/stok/monitoring` | AYAM 10→**30**, BAWANG 4→**7**, KENTANG tetap **8** | ✅ |

**Cek SQL (jalankan setelah B5):**
```sql
-- Diharapkan: AYAM=30, BAWANG=7, KENTANG=8 (KENTANG tak berubah karena rusak)
SELECT o.name, b.nama, sb.saldo
FROM stok_balance sb
JOIN outlets o ON o.id=sb.outlet_id
JOIN bahan_baku b ON b.id=sb.bahan_baku_id
WHERE o.name='SUKA SHAWARMA EMPANG' AND b.nama IN ('AYAM','BAWANG','KENTANG')
ORDER BY b.nama;
```

> ✅ **Concern resolved (2026-06-11):** Item rusak kini menghasilkan ledger tipe `rejected_kiriman` qty=0 dengan catatan "Ditolak N unit rusak: [alasan]". Stok tidak bertambah, tapi audit trail tersimpan. Migration: `20260611000200_add_rejected_kiriman_tipe.sql`.

---

## TEST C — Idempotency & integritas

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| C1 | Coba buka kembali SJ yang sudah **diterima** lalu paksa verifikasi ulang | Tidak boleh dobel; diarahkan ke detail, bukan form | ✅ (guard di RPC + UI redirect ditambahkan) |
| C2 | Jalankan SQL konsistensi saldo (di bawah) | **0 baris** (saldo = jumlah ledger) | ✅ |

```sql
-- Konsistensi: saldo harus sama dengan SUM(ledger). Harus 0 baris.
SELECT outlet_id, bahan_baku_id
FROM (
  SELECT outlet_id, bahan_baku_id, SUM(qty) AS computed
  FROM ledger_stok GROUP BY outlet_id, bahan_baku_id
) agg
JOIN stok_balance sb USING (outlet_id, bahan_baku_id)
WHERE ABS(agg.computed - sb.saldo) > 0.001;
```

---

## TEST D — Isolasi multi-outlet (RLS)

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| D1 | Login Empang → `/stok/ledger`, salin URL request ledger dari DevTools→Network | — | ✅ |
| D2 | Logout, login **Sukmajaya** (`budi.sukmajaya@...`) | Outlet = Sukmajaya | ✅ |
| D3 | Tempel URL ledger Empang di tab baru | **Array kosong / 401** — BUKAN data Empang | ✅ **401 Unauthorized** (lebih ketat dari expected) |
| D4 | Cek `/distribusi/terima` sebagai Sukmajaya | SJ untuk Empang **tidak** muncul | ✅ "Belum ada kiriman masuk" |
| D5 | Opname paralel: Empang & Sukmajaya finalisasi bersamaan | Keduanya sukses, data tidak tercampur | ⬜ belum diuji |

---

## TEST E — Mobile / Device nyata (Android Chrome) — paling rawan

| # | Langkah | Hasil | ✅/❌ |
|---|---------|-------|-------|
| E1 | Login di HP Android | Keyboard email muncul benar | |
| E2 | Opname: input qty | Keyboard numerik (`inputmode`) | |
| E3 | Tombol min 44px, tidak perlu zoom | Mudah di-tap | |
| E4 | Tidak ada scroll horizontal di semua halaman | — | |
| E5 | **Canvas tanda tangan** di layar sentuh | Garis tergambar mulus, tersimpan | |
| E6 | **Scan QR** kamera belakang | QR terbaca < 3 detik | |
| E7 | Jika device tanpa BarcodeDetector (iOS/Safari) | Muncul fallback input manual | |
| E8 | **Print PDF** dari browser Android | QR & tabel TT tercetak benar | |

---

## Kriteria Lulus (Go / No-Go)

- ✅ **Wajib lulus:** TEST B (integrasi), C (integritas), D (isolasi). Ini blocker — gagal = tidak boleh launch.
- 🟡 **Sebaiknya lulus:** TEST A, E. Gagal E = batasi ke device yang didukung dulu.

---

## Troubleshooting cepat

| Gejala | Cek |
|--------|-----|
| Saldo tidak bertambah setelah verifikasi | RPC `finalize_surat_jalan_and_ledger` error? Cek Supabase Logs → Postgres |
| Ledger dobel | Lihat `ABS(computed-saldo)` query (C2) + idempotency `20260609001900` |
| Scan QR tidak jalan | BarcodeDetector tak ada di browser → harus muncul fallback manual (E7) |
| TT muncul kotak hitam di PDF | Format PNG (sudah fixed `572c919`), cek ukuran ≤ 50KB |
| Data outlet bocor antar-akun | STOP — audit RLS `surat_jalan` + `ledger_stok` (D3) |
| SJ tidak muncul di terima | Status SJ harus **dikirim**, dan outlet tujuan = outlet crew yang login |

---

## Catatan untuk eksekutor
- Mulai dari **TEST B** kalau waktu terbatas — itu inti integrasi M2↔M3.
- Snapshot saldo (0.2) wajib, kalau tidak hasil B5 tak bisa diverifikasi.
- Untuk role "Supir" tidak perlu akun terpisah; di flow TT pilih role Supir pada tanda tangan ke-2.
