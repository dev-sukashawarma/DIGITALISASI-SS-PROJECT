# E2E Runbook — Step by Step + Checklist Sukses + Titik Kritis

> Pendamping praktis dari `docs/E2E-TEST-M2-M3.md`. Ikuti urut dari atas.
> Legenda: ⏱️ perkiraan waktu · 🟢 checklist sukses · 🔴 titik kritis (kalau gagal di sini, STOP).
>
> **Progress eksekusi (update 2026-06-11):** FASE 0 ✅ LULUS · FASE A ✅ LULUS · FASE B ✅ LULUS · FASE C–E ⬜ belum dijalankan.

---

## FASE 0 — Persiapan ⏱️ 15 menit

### Langkah
1. Pastikan app jalan (dev/staging) dan bisa diakses dari browser.
2. Buka Supabase SQL Editor → jalankan seluruh isi `supabase/seed-e2e-test.sql`.
3. Lihat 2 query output di akhir seed.
4. Siapkan 2 browser/profil (atau 1 normal + 1 incognito) untuk uji 2 user paralel.
5. Login coba semua akun sekali untuk pastikan bisa masuk:
   - `spv@test.com` (Kitchen)
   - `andi.empang@sukashawarma.com` (Empang)
   - `budi.sukmajaya@sukashawarma.com` (Sukmajaya)

### 🟢 Checklist sukses Fase 0 — ✅ LULUS (2026-06-11)
- [x] Seed jalan tanpa error
- [x] Tabel saldo: EMPANG AYAM=10, BAWANG=4, KENTANG=8 (sesuai baseline)
- [x] Query konsistensi terakhir = **0 baris**
- [x] Ketiga akun bisa login dan outlet ter-set benar

### 🔴 Titik kritis Fase 0
- **Konsistensi ≠ 0 baris** → ada saldo lama tanpa ledger (warisan INSERT langsung). Catat baris bermasalah; jangan lanjut sebelum dipahami, karena cek integritas di Fase C pasti gagal.
- **Akun tidak bisa login** → `outlet_staff.id` tidak sama dengan `auth.users.id`. Tidak ada gunanya lanjut.

> **Catatan eksekusi Fase 0:**
> 1. **Konsistensi awal GAGAL (21+ baris drift)** — data lama hasil `INSERT` langsung ke `stok_balance` (99 baris dari M3 Phase 1) tidak punya ledger pendukung. **Solusi:** `DELETE` ledger+balance 4 outlet pilot, lalu jalankan ulang seed. Setelah itu konsistensi = 0 baris. ✅
> 2. **Password `andi.empang` lupa** → di-reset via SQL: `UPDATE auth.users SET encrypted_password = crypt('test', gen_salt('bf')) WHERE email='andi.empang@sukashawarma.com';` (password sekarang: `test`).

---

## FASE A — M2 Stok (opname → ledger → monitoring) ⏱️ 20 menit
**Login: Crew Empang**

### Langkah
1. `/stok/opname/new`, tipe **harian**.
2. Hitung 5 bahan; buat 3 item selisih >15% (mis. AYAM dibuat jauh dari sistem).
3. Klik **Finalisasi Opname**.
4. `/stok/ledger` → periksa entri `opname_selisih`.
5. Klik 1 entri → cek matematika saldo.
6. `/stok/monitoring` → cek urutan & warna status.
7. `/stok/ledger/new` → `waste`, qty 2, AYAM → submit.

### 🟢 Checklist sukses Fase A — ✅ LULUS (2026-06-11)
- [x] Item selisih >15% border merah saat input (AYAM +100%, BAWANG +25%, KENTANG -50%)
- [x] Finalisasi → redirect + "1 selesai hari ini"
- [x] Jumlah entri `opname_selisih` = jumlah item selisih ≠ 0 (3 entri)
- [x] `saldo_sesudah = saldo_sebelum + qty` benar (AYAM 10+10=20, BAWANG 4+1=5, KENTANG 8-4=4)
- [x] Monitoring: satuan sesuai DB (kg/pack/crt), bukan tebakan
- [x] Waste qty muncul **-2** (merah), saldo AYAM turun 2
- [x] Live Monitoring (`/stok/monitoring-live`, SPV) tampil + alarm item kritis

### 🔴 Titik kritis Fase A
- **Finalisasi gagal/timeout** → cek RPC `finalize_opname` di Supabase Logs.
- **Saldo_sesudah salah** → trigger `ledger_stamp_saldo` bermasalah; integritas seluruh M2 dipertaruhkan.

> **Bug ditemukan & diperbaiki di Fase A:**
> 1. **Monitoring kosong + "Connection unstable"** — `apps/stok/src/lib/queries/monitoring.ts` membuat raw client `@supabase/supabase-js` sendiri tanpa session SSR → `Not authenticated`. **Fix:** pakai client bersama `@/lib/supabase` (createBrowserClient). Commit `e8d0636`. Memperbaiki crew & SPV monitoring sekaligus.
> 2. **Nested `<a>` hydration error** di `/dashboard` — `<Link>` di dalam `<Link>`. **Fix:** outer jadi `<div>` + `router.push`. Commit `83dc988`.
> 3. **Monitoring hanya 3 bahan** — seed E2E sengaja minimal. Ditambah seed semua 33 bahan di Empang (target = 2× reorder_point) via ledger adjustment (konsisten). Status warna terverifikasi: KENTANG 🔴, AYAM 🟡, BAWANG 🟢, sisanya 🟢.

---

## FASE B — Integrasi M2↔M3 (INTI) ⏱️ 30 menit

### B1–B2: Buat & tanda tangani SJ — **Login: SPV**
1. `/distribusi/surat-jalan/new` → tujuan **EMPANG**.
2. Tambah: **AYAM 20**, **BAWANG 5**, **KENTANG 4** → submit.
3. Buka detail → tanda tangan ke-1 (role SPV Kitchen) di canvas.
4. Coba **Kirim** dengan 1 TT → harus ditolak.
5. Tanda tangan ke-2 (role Supir).
6. Coba TT canvas kosong → harus ditolak.
7. Klik **Kirim** → status jadi **dikirim**.

### B3: PDF + QR
8. Download PDF → cek header brand, tabel item, tabel TT bergambar, QR di bawah.
9. Scan QR PDF pakai kamera HP → membuka URL ke SJ tsb.

### B4: Terima & verifikasi — **Login: Crew Empang**
10. `/distribusi/terima` → SJ dari Kitchen muncul.
11. Klik **Scan QR** → scan (atau input manual nomor).
12. Kartu AYAM → **Baik** (20).
13. Kartu BAWANG → **Baik**, ubah qty diterima jadi **3**.
14. Kartu KENTANG → **Jelek**, kosongkan catatan → harus ditolak; isi catatan → lanjut.
15. Ringkasan → **Selesai & Simpan Verifikasi**.

### B5: Cek auto-ledger
16. `/stok/ledger` Empang → cek entri masuk.
17. `/stok/monitoring` → cek saldo.

### 🟢 Checklist sukses Fase B — ✅ LULUS (2026-06-11)
- [x] Nomor dokumen auto `SJ/KITCHEN/YYYYMMDD/NNN` (SJ/KITCHEN/20260611/0002)
- [x] Kirim dengan 1 TT **ditolak**; TT kosong **ditolak**
- [x] Status SJ: draft → dikirim → diterima_lengkap (sesuai tahap)
- [x] QR di PDF bisa di-scan → buka SJ yang benar
- [x] Jelek tanpa catatan **ditolak**
- [x] Ledger Empang: **AYAM +20**, **BAWANG +3** (tipe `terima_kiriman`)
- [x] **KENTANG TIDAK ada** entri ledger (rusak = 0 impact)
- [x] Monitoring: AYAM **30**, BAWANG **7**, KENTANG **8**
- [x] Riwayat halaman terpisah: `/distribusi/riwayat` tampil SJ `diterima_lengkap` + `diterima_sebagian`
- [x] TTD penerima (Crew Penerima + Supir) diambil sebelum finalize → tersimpan di `receipt_signatures`
- [x] Cross-outlet view SPV Pusat: `/distribusi/pengiriman` tampil semua SJ semua outlet
- [x] GlobalAccountBar logout pill ada di semua protected page

### 🔴 Titik kritis Fase B
- **Saldo tidak bertambah setelah verifikasi** → RPC `finalize_surat_jalan_and_ledger` gagal. Cek Supabase Logs → Postgres. Ini blocker utama integrasi.
- **BAWANG masuk +5 bukan +3** → form mengirim `qty_dikirim`, bukan `qty_terima`. Bug serius (stok palsu).
- **KENTANG ternyata masuk ledger** → berarti mapping kondisi salah; tapi kalau KENTANG **tidak** masuk = benar secara kode, namun ini **concern audit** (rusak hilang tanpa jejak — catat untuk perbaikan).
- **QR tidak bisa di-scan** → cek BarcodeDetector / fallback (lihat Fase E).

---

## FASE C — Idempotency & integritas ⏱️ 10 menit

### Langkah
1. Buka kembali SJ yang sudah **diterima**, coba paksa verifikasi ulang.
2. Jalankan SQL konsistensi saldo (di bawah).

```sql
SELECT outlet_id, bahan_baku_id
FROM (
  SELECT outlet_id, bahan_baku_id, SUM(qty) AS computed
  FROM ledger_stok GROUP BY outlet_id, bahan_baku_id
) agg
JOIN stok_balance sb USING (outlet_id, bahan_baku_id)
WHERE ABS(agg.computed - sb.saldo) > 0.001;
```

### 🟢 Checklist sukses Fase C
- [ ] Verifikasi ulang SJ diterima **tidak** menambah ledger dobel (diarahkan ke detail)
- [ ] Query konsistensi = **0 baris**

### 🔴 Titik kritis Fase C
- **Ledger dobel** → tidak ada guard idempotency di RPC verifikasi. Stok jadi over-count. Blocker.
- **Konsistensi ≠ 0** → ada drift saldo. Investigasi sebelum launch.

---

## FASE D — Isolasi multi-outlet (RLS) ⏱️ 15 menit

### Langkah
1. Login Empang → `/stok/ledger`; DevTools → Network → salin URL request ledger.
2. Logout, login **Sukmajaya**.
3. Tempel URL ledger Empang di tab baru.
4. Cek `/distribusi/terima` sebagai Sukmajaya.
5. Opname paralel: Empang & Sukmajaya finalisasi bersamaan (2 browser).

### 🟢 Checklist sukses Fase D
- [ ] URL ledger Empang dari akun Sukmajaya → **array kosong / 401**
- [ ] SJ untuk Empang **tidak** muncul di terima Sukmajaya
- [ ] Opname paralel: keduanya sukses, data tidak tercampur

### 🔴 Titik kritis Fase D
- **Data Empang terlihat oleh Sukmajaya** → kebocoran RLS. **STOP TOTAL** — ini pelanggaran keamanan, audit RLS `surat_jalan` + `ledger_stok` + `stok_balance` sebelum apa pun.

---

## FASE E — Device Android nyata ⏱️ 20 menit (paling rawan)

### Langkah
1. Buka app di HP Android (Chrome). Login.
2. Opname: input qty → cek keyboard numerik.
3. Canvas tanda tangan: gambar dengan jari.
4. Scan QR: kamera belakang baca QR dari PDF.
5. Print PDF dari browser.
6. (Jika ada iPhone/Safari) buka halaman scan.

### 🟢 Checklist sukses Fase E
- [ ] Keyboard numerik muncul untuk qty
- [ ] Tombol mudah di-tap (≥44px), tidak ada scroll horizontal
- [ ] Garis TT tergambar mulus & tersimpan (tidak jadi kotak hitam di PDF)
- [ ] QR terbaca < 3 detik
- [ ] PDF tercetak: QR & tabel TT benar
- [ ] iOS/Safari: muncul **fallback input manual** (bukan layar blank)

### 🔴 Titik kritis Fase E
- **Canvas TT jadi kotak hitam di PDF** → regresi format gambar (harus PNG ≤50KB).
- **Scan blank di iOS** tanpa fallback → crew iPhone tak bisa terima barang. Batasi device atau tambah `html5-qrcode`.
- **PDF print QR pecah/terpotong** → QR tak terbaca = alur scan putus.

---

## RINGKASAN GO / NO-GO

| Fase | Wajib lulus? | Status | Kalau gagal |
|------|--------------|--------|-------------|
| 0 Persiapan | ✅ | ✅ LULUS | Perbaiki data/akun dulu |
| A M2 | 🟡 disarankan | ✅ LULUS | Bisa lanjut, catat bug |
| **B Integrasi** | ✅ **WAJIB** | ✅ LULUS | — |
| **C Integritas** | ✅ **WAJIB** | ⬜ belum | **NO-GO** |
| **D Isolasi RLS** | ✅ **WAJIB** | ⬜ belum | **NO-GO (keamanan)** |
| E Device | 🟡 disarankan | ⬜ belum | Batasi ke device didukung |

**Verdict GO** hanya jika **B + C + D semua hijau**. → **Saat ini: B ✅ lulus, C + D belum dijalankan. Siap lanjut C & D.**

### Reset antar percobaan
Untuk mengulang dari awal: jalankan ulang `supabase/seed-e2e-test.sql` (mengembalikan
baseline). Hapus SJ test bila perlu lewat SQL (`DELETE FROM surat_jalan WHERE document_number LIKE 'SJ/KITCHEN/%'` — hati-hati, hapus juga ledger `terima_kiriman` terkait bila ingin saldo benar-benar bersih).
