# Runbook Go-Live: Drop-Ship Sayur (20–21 September 2026)

**Audiens:** Owner · Pusat (purchasing / kitchen / admin) · Crew outlet
**Sumber kebenaran:** `docs/superpowers/plans/2026-09-11-drop-ship-sayur.md` Task 10,
`docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md` §9.
**Status saat runbook ini ditulis (11 September 2026):** database sudah **LIVE**
(lihat di bawah), kode aplikasi masih di branch `feat/drop-ship-sayur`,
**belum merge/push/redeploy**.

---

## 0. Apa yang sudah hidup, apa yang belum

| Bagian | Status per 11 Sep 2026 |
|---|---|
| Migration DB `20260911120000_drop_ship_skema` | ✅ LIVE & terstempel |
| Migration DB `20260911121000_drop_ship_catat_terima` | ✅ LIVE & terstempel |
| Migration DB `20260911122000_drop_ship_sahkan_nota` | ✅ LIVE & terstempel |
| Migration DB `20260911123000_drop_ship_laporan` (view `nilai_masuk_drop_ship_harian`) | ✅ LIVE & terstempel |
| Skrip `supabase/verifikasi/drop_ship/pemantau.sql` | ✅ 4 kueri jalan di DB live, semua 0 baris (wajar sebelum go-live) |
| Kode app (`apps/stok`): halaman crew & Pusat, hook, predikat peran | ✅ **Sudah di `main` & live** (dicek 15 Sep 2026) — butir "merge/push/redeploy" di §1 sudah terpenuhi |
| Smoke test browser (login sungguhan) | ✅ **LULUS 16 Sep 2026** (owner) — alur crew → Pusat → tolak terbukti utuh. Diverifikasi ke DB: 2 catatan uji, keduanya outlet tes, keduanya `ditolak`, **0 nota** & **0 PO** terbentuk, dan 4 baris ledger **berpasangan tepat** (+2000/−2000, +1000/−1000) — penolakan benar-benar membalik stok, bukan sekadar menandai dokumen. Sisa yang belum terbukti: **mode pantau owner/admin_finance** |
| **Hanya sayur** (keputusan owner 15 Sep 2026) | ✅ Migration `20260915110000_drop_ship_hanya_bahan_bertanda`: penanda `bahan_baku.drop_ship`, hanya **Sayur (lettuce)** menyala. `catat_terima_vendor` & `info_terima_vendor` **menolak bahan lain** (sebelumnya crew bisa mencatat mis. SAPI dari Pak Aziz dan stok outlet bertambah tanpa surat jalan). Form crew hanya menampilkan sayur; daftar vendor di halaman nota hanya vendor sayur. Uji `supabase/verifikasi/drop_ship/t8_hanya_sayur.sql` LULUS |

**Cek kesiapan 15 Sep 2026 (DB live):** bucket foto `drop-ship` ada · harga terkunci sayur
Rp 22.000/kg (dari harga master; katalog vendor masih Rp 0 `perlu_ditinjau`) · termin
Tempo 10 = 10 hari · pengesah & penolak = purchasing/kitchen/admin · **4 outlet saldo
sayur minus** (opname baseline 20 malam yang menormalkannya) · 75 `adjustment` sayur
manual sejak 1 Sep (harus menurun ke 0 setelah 21 Sep, Q4 pemantau).

Menambah bahan drop-ship kelak: `UPDATE bahan_baku SET drop_ship = true WHERE nama = '…'`
**dan** pastikan bahan itu punya baris katalog vendor aktif — tanpa perubahan kode.

Karena bagian database dan bagian kode belum berjalan bersamaan, **jangan
mengumumkan ke outlet sebelum §1 selesai** — kalau kode belum live di
`stok.sukashawarma.com`, crew akan mencari menu "Terima dari Vendor" yang belum ada.

---

## 1. Sebelum 20 September — syarat wajib

- [x] Seluruh branch `feat/drop-ship-sayur` (Task 1–10) di-merge ke `main` dan
      **di-push** (izin owner).
- [x] App `stok` **di-redeploy** (otomatis lewat GitHub Actions `deploy-stok-coolify`
      saat push `main` menyentuh `apps/stok/**`).
- [x] Semua tab browser yang sudah kebuka sebelum redeploy di-**hard refresh**
      atau ditutup-buka ulang. Error "Server Action ... was not found on the
      server" setelah redeploy itu efek normal Next.js, bukan bug.
- [x] **Smoke test login sungguhan** — ✅ **LULUS 16 Sep 2026**, kecuali butir
      "mode pantau" terakhir yang belum dicoba. — pakai akun crew **outlet TES**, jangan
      outlet sungguhan (catatan di outlet sungguhan menambah stok sayur palsu):
  - Login sebagai **crew outlet tes** → menu **"Terima dari Vendor"**
    (`/stok/terima-vendor`) → catat 1 kg sayur → cek baris muncul di daftar
    "7 Hari Terakhir" dan kotak "Akan tercatat" menunjukkan satuan yang benar.
  - Login sebagai **purchasing/kitchen/admin** → menu **"Cocokkan Nota Vendor"**
    (`/stok/nota-vendor`) → pilih vendor `Lettuce (Pak Aziz) - Tempo 10` dan
    tanggal tagihan 20 Sep → catatan uji tadi muncul.
  - **Tolak** catatan uji itu (tombol "Tolak", isi alasan "uji coba") → stok
    outlet tes kembali seperti semula dan catatan tidak ikut ke nota mana pun.
    **Jangan sahkan nota dalam smoke test** — pengesahan menulis PO utang sungguhan.
  - ⚠️ **BELUM DICOBA:** login sebagai **owner** atau **admin_finance** → halaman
    nota terbuka dalam "Mode pantau", tombol sahkan/tolak tidak ada. Satu-satunya
    butir §1 yang tersisa; bukan penghalang go-live (kalau gagal, akibatnya owner
    bisa menyahkan nota — bukan crew), tapi layak dicek sekali sebelum 30 Sep.

**Hasil uji 16 Sep 2026, diverifikasi ke DB** (bukan sekadar laporan layar):
`terima_vendor_outlet` → 2 baris, keduanya outlet tes, keduanya `ditolak`,
`nota_vendor_id` NULL. `nota_vendor` 0 baris, PO dari nota 0. `ledger_stok`
ber-`ref_terima_vendor_id` 4 baris dan **saling meniadakan**: `pembelian_supplier`
+2000 (11 Sep) diikuti `rejected_kiriman` −2000 empat menit kemudian, lalu +1000
(15 Sep) diikuti −1000. Nol catatan menggantung yang bisa ikut tersapu ke nota
30 September.

---

## 2. 20 September sore — pemberitahuan & opname baseline

- [ ] **Kabari semua outlet:** mulai besok (21 September), sayur dicatat lewat
      menu **"Terima dari Vendor"**, **bukan** lagi lewat penyesuaian manual
      (`adjustment`).
- [ ] **Opname sayur wajib diisi malam ini di semua outlet** — kolom fisik
      **tidak boleh dikosongkan**. Ini baseline stok drop-ship yang mulai besok.
      *(Definisi resmi opname, Session 2026-09-08: dikosongkan = belum dihitung;
      diisi 0 = fisik benar-benar habis.)*

---

## 3. 21 September pagi — verifikasi baseline

- [ ] Pastikan **tidak ada outlet operasional yang minus** sesudah opname 20 malam:

```sql
SELECT o.name, sb.saldo
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o ON o.id = sb.outlet_id
WHERE b.nama ILIKE '%lettuce%' AND o.type <> 'test'
ORDER BY o.name;
```

- [ ] Sejak hari ini, crew **berhenti memakai `adjustment` untuk sayur**.

---

## 4. 21–30 September — pemantauan harian

- [ ] Tiap pagi jalankan `supabase/verifikasi/drop_ship/pemantau.sql`
      (CLI hanya menampilkan hasil kueri terakhir — jalankan per kueri bila perlu):
  - **Q1** catatan lewat tanggal tagihan belum disahkan — normalnya 0 kecuali
    sehari setelah tanggal tagihan.
  - **Q2** PO diterima tanpa ledger (sudah mengecualikan PO nota drop-ship) — harus 0.
  - **Q3 harus 0 selalu** — 1 baris pun berarti trigger stok gagal/di-bypass.
  - **Q4** `adjustment` sayur manual sejak 21 Sep harus **menurun ke 0**; kalau
    tidak, ada outlet yang masih pakai jalur lama — tegur ulang.
- [ ] Setelah 21 Sep **jangan pakai akun outlet tes** di modul ini. Catatan outlet
      tes ke vendor Tempo 10 ikut tampil di layar nota dan akan ikut tersahkan.
      Kalau terlanjur ada, **tolak** baris outlet tes sebelum mengesahkan nota.

---

## 5. 30 September — nota pertama

- [ ] Nota pertama (foto WhatsApp dari Pak Aziz) disahkan di **`/stok/nota-vendor`**
      oleh purchasing/kitchen/admin. Selisih catatan crew vs nota > 0,5% wajib
      diberi penjelasan.
- [ ] Periksa PO bernomor `NV/20260930/…` muncul di utang finance, jatuh tempo
      **30 September**, status `unpaid`.
- [ ] Owner & admin_finance memantau (read-only).

---

## 6. Setelah 30 September — catat hasil & tutup runbook

- [ ] Tambah entri sesi baru di `CLAUDE.md`: apa yang benar-benar hidup, angka
      baseline opname 20 malam, hasil nota pertama — **hanya angka terukur**.
- [ ] Perbarui memori `drop-ship-sayur-pak-aziz.md` dengan status akhir.
- [ ] `git branch --show-current` sebelum commit; tanya owner sebelum push.

---

## Catatan penting

### Deadlock migration ledger_stok
Migration skema pertama sempat **deadlock dengan realtime** (`ledger_stok` ada di
publication `supabase_realtime`) — dibatalkan bersih, lalu diterapkan per potongan.
Migration berikutnya yang menyentuh struktur `ledger_stok` wajib `SET lock_timeout`
dan diterapkan per potongan kecil.

### Temuan terbuka — policy `bbhh_select` salah ketik
Policy `bbhh_select` mengizinkan role `'purchase'`, bukan `'purchasing'` →
**purchasing tidak bisa membaca riwayat harga** (`bahan_baku_harga_history`).
Penulisan riwayat tetap jalan. **Belum diperbaiki — butuh izin owner.**

### Harga master sayur ikut nota
Harga master sayur **ikut nota** saat disahkan (spec §9). **Penjaga rasio-faktor**
menahan harga yang rasionya persis faktor konversi bahan (sidik jari salah satuan,
mis. harga per gram) dan mencatat penolakannya di riwayat — periksa satuan nota
sebelum menganggapnya bug.

---

## Referensi

- Plan: `docs/superpowers/plans/2026-09-11-drop-ship-sayur.md`
- Spec: `docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md` (§9)
- Migration: `supabase/migrations/20260911120000_drop_ship_skema.sql`,
  `20260911121000_drop_ship_catat_terima.sql`,
  `20260911122000_drop_ship_sahkan_nota.sql`,
  `20260911123000_drop_ship_laporan.sql`
- Uji: `supabase/verifikasi/drop_ship/t2_skema.sql`, `t3_catat.sql`, `t7_sahkan.sql`, `t7b_rasio.sql`
- Pemantau: `supabase/verifikasi/drop_ship/pemantau.sql`
- Memori: `drop-ship-sayur-pak-aziz.md`
