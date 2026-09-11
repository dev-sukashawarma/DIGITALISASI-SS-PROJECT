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
| Kode app (`apps/stok`): halaman crew & Pusat, hook, predikat peran | Ada di branch `feat/drop-ship-sayur`, **belum merge ke `main`, belum push, belum redeploy** |
| Smoke test browser (login sungguhan) | **Belum dijalankan** — wajib sebelum 20 September |

Karena bagian database dan bagian kode belum berjalan bersamaan, **jangan
mengumumkan ke outlet sebelum §1 selesai** — kalau kode belum live di
`stok.sukashawarma.com`, crew akan mencari menu "Terima dari Vendor" yang belum ada.

---

## 1. Sebelum 20 September — syarat wajib

- [ ] Seluruh branch `feat/drop-ship-sayur` (Task 1–10) di-merge ke `main` dan
      **di-push** (izin owner).
- [ ] App `stok` **di-redeploy** di Coolify.
- [ ] Semua tab browser yang sudah kebuka sebelum redeploy di-**hard refresh**
      atau ditutup-buka ulang. Error "Server Action ... was not found on the
      server" setelah redeploy itu efek normal Next.js, bukan bug.
- [ ] **Smoke test login sungguhan** — pakai akun crew **outlet TES**, jangan
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
  - Login sebagai **owner** atau **admin_finance** → halaman nota terbuka dalam
    "Mode pantau", tombol sahkan/tolak tidak ada.

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
