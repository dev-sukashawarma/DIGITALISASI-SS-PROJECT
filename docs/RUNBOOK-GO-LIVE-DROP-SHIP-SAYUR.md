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
| Migration DB Task 9 (view pemantau, `20260911123000_drop_ship_laporan`) | Mungkin menyusul — rujuk berkasnya di branch bila sudah ada sebelum melangkah ke §1 |
| Kode app (`apps/stok`): halaman crew & Pusat, hook, RPC caller | Ada di branch `feat/drop-ship-sayur`, **belum merge ke `main`, belum push, belum redeploy** |
| Smoke test browser (login sungguhan) | **Belum dijalankan** — wajib sebelum 20 September |

Karena bagian database dan bagian kode belum berjalan bersamaan, **jangan
mengumumkan ke outlet sebelum §1 selesai** — kalau kode belum live di
`stok.sukashawarma.com`, crew akan mencari menu "Terima dari Vendor" yang belum ada.

---

## 1. Sebelum 20 September — syarat wajib

- [ ] Task 1–6 (kode `apps/stok`) sudah di-merge ke `main` dan **di-push**.
- [ ] App `stok` **di-redeploy** di Coolify (lihat gotcha Docker di bagian atas
      `CLAUDE.md` — secret server-only wajib ter-declare di stage runner; kalau
      redeploy pertama sejak sesi ini, cek dulu apakah ada perubahan Dockerfile).
- [ ] Semua tab browser yang sudah kebuka sebelum redeploy di-**hard refresh**
      atau ditutup-buka ulang. Ini bukan investigasi kode kalau muncul error
      "Server Action ... was not found on the server" — itu efek normal Next.js
      (ID Server Action berubah tiap build).
- [ ] **Smoke test login sungguhan** (belum pernah dijalankan sesi manapun sampai
      titik ini):
  - Login sebagai **crew** outlet → buka menu **"Terima dari Vendor"**
    (`/stok/terima-vendor`) → catat satu terima uji coba **di outlet sungguhan
    milik crew itu** (bukan outlet tes — lihat catatan §4 di bawah soal kontaminasi
    outlet tes) → verifikasi baris masuk & stok bertambah.
  - Login sebagai **purchasing/kitchen/admin** → buka menu **"Cocokkan Nota
    Vendor"** (`/stok/nota-vendor`) → verifikasi catatan uji coba di atas muncul
    di layar, dan tombol sahkan/tolak berfungsi.
  - Login sebagai **owner** atau **admin_finance** → verifikasi bisa **melihat**
    halaman nota vendor (peran pemantau, tanpa hak sahkan).

---

## 2. 20 September sore — pemberitahuan & opname baseline

- [ ] **Kabari semua outlet:** mulai besok (21 September), sayur dicatat lewat
      menu **"Terima dari Vendor"**, **bukan** lagi lewat penyesuaian manual
      (`adjustment`).
- [ ] **Opname sayur wajib diisi malam ini di semua outlet** — kolom fisik
      **tidak boleh dikosongkan**. Ini baseline: opname 20 malam adalah titik
      nol untuk perhitungan stok drop-ship yang mulai besok.
      *(Ingat definisi resmi opname, Session 2026-09-08: kolom dikosongkan =
      belum dihitung/dilewati; kolom diisi 0 = fisik benar-benar habis. Untuk
      baseline ini, "wajib diisi" berarti kolom sayur harus ada isian nyata,
      bukan dikosongkan.)*

---

## 3. 21 September pagi — verifikasi baseline

- [ ] Jalankan query berikut dan pastikan **tidak ada outlet operasional yang
      minus** sesudah opname 20 malam:

```sql
SELECT o.name, sb.saldo
FROM stok_balance sb
JOIN bahan_baku b ON b.id = sb.bahan_baku_id
JOIN outlets o ON o.id = sb.outlet_id
WHERE b.nama ILIKE '%lettuce%'
ORDER BY o.name;
```

- [ ] Sejak hari ini, crew **berhenti memakai `adjustment` untuk sayur** —
      semua terima sayur baru lewat "Terima dari Vendor" saja.

---

## 4. 21–30 September — pemantauan harian

- [ ] Tiap pagi jalankan `supabase/verifikasi/drop_ship/pemantau.sql`:
  - **Q3 harus 0** (jaga terus, bukan cuma sekali).
  - **Q4** (jumlah `adjustment` manual sayur) harus **menurun ke 0** — kalau
    tidak turun, berarti ada outlet yang masih memakai jalur lama; tegur ulang.
- [ ] **Peringatan uji coba lapangan:** kalau ada latihan/uji fitur dengan akun
      crew **outlet TES**, catatannya ke vendor **Tempo 10** ikut tampil di
      layar nota — dan kalau tidak disaring, ikut **tersahkan** ke nota asli.
      Jangan pakai akun outlet tes untuk apa pun setelah 21 September; kalau
      sudah terlanjur ada catatan uji coba tercampur, purchasing/kitchen/admin
      wajib memeriksa manual dan **menolak** baris outlet tes sebelum
      mengesahkan nota periode 21–30 Sep.

---

## 5. 30 September — nota pertama

- [ ] Nota pertama (foto WhatsApp dari Pak Aziz) disahkan di **`/stok/nota-vendor`**
      oleh purchasing/kitchen/admin.
- [ ] Periksa PO dengan pola nomor `NV/20260930/…` muncul di layar utang finance,
      dengan **jatuh tempo 30 September**.
- [ ] Owner & admin_finance memantau (peran read-only) untuk memastikan total
      nota cocok dengan rekap catatan crew periode 21–30 Sep.

---

## 6. Setelah 30 September — catat hasil & tutup runbook

- [ ] Tambah entri sesi baru di `CLAUDE.md` yang mencatat: apa yang benar-benar
      hidup di tanggal itu, angka baseline opname 20 malam (§3), dan hasil nota
      pertama (§5) — **hanya angka yang benar-benar terukur saat itu**, jangan
      isi dari runbook ini (runbook ini ditulis sebelum go-live terjadi, jadi
      tidak memuat angka hasil).
- [ ] Perbarui memori `drop-ship-sayur-pak-aziz.md` dengan status akhir.
- [ ] `git branch --show-current` sebelum commit.
- [ ] **Tanyakan owner sebelum push** bila `main` sudah memuat commit sesi lain
      sejak branch ini dibuat (kebiasaan proyek: otomasi repo aktif memindahkan
      HEAD/menggabungkan branch di tengah sesi — cek dulu, jangan asumsikan
      `main` masih sama seperti saat branch dibuat).

---

## Catatan penting yang jangan sampai terlewat

### Deadlock migration ledger_stok (pelajaran dari penerapan Task 1–8)
Saat migration pertama diterapkan, sempat terjadi **deadlock dengan realtime**
karena `ledger_stok` ada di publication `supabase_realtime`. Migration mana pun
berikutnya yang **menyentuh struktur `ledger_stok`** (kolom baru, index, trigger)
wajib diterapkan **per potongan kecil**, dengan `lock_timeout` diset lebih dulu
— jangan satu statement besar yang mengunci tabel lama.

### Temuan terbuka — policy `bbhh_select` salah ketik
Ada kesalahan ketik `'purchase'` di policy `bbhh_select` yang membuat
**purchasing tidak bisa membaca riwayat harga bahan baku** (`bahan_baku_harga_history`).
**Belum diperbaiki** — butuh izin owner sebelum disentuh (ini tabel/policy
produksi, bukan bagian dari migration Task 1–9). Purchasing yang mengesahkan
nota vendor mungkin perlu riwayat harga untuk memutuskan apakah selisih harga
wajar — laporkan ke owner sebelum 30 September kalau ini menghambat pengesahan.

### Harga master sayur ikut nota
Sesuai keputusan owner (spec §9 poin 3), harga master bahan sayur **ikut nota**
begitu nota disahkan. Ada **penjaga rasio-faktor** yang menahan harga yang
tampak salah satuan (pola sama dengan penjaga isi-kemasan FOIL) — kalau harga
dari nota ditolak penjaga ini, itu tanda kemungkinan salah satuan di nota atau
di master, bukan bug: periksa dulu sebelum memaksa lolos.

### Jangan uji coba dengan akun outlet sungguhan setelah 21 September
Sebaliknya — dan ini yang sudah terjadi: uji coba lapangan yang dilakukan
**sebelum** go-live memakai akun crew **outlet TES**, dan catatannya ke vendor
**Tempo 10** ikut tampil (dan berisiko ikut tersahkan) di nota asli. Lihat §4
untuk langkah mitigasi. Ke depan, uji coba fitur apa pun di modul ini **wajib**
memakai akun outlet tes yang benar-benar terisolasi dari siklus nota nyata, atau
dijadwalkan di luar jendela pengesahan.

---

## Referensi

- Plan: `docs/superpowers/plans/2026-09-11-drop-ship-sayur.md` (Task 10)
- Spec: `docs/superpowers/specs/2026-09-11-drop-ship-sayur-design.md` (§9)
- Migration: `supabase/migrations/20260911120000_drop_ship_skema.sql`,
  `20260911121000_drop_ship_catat_terima.sql`,
  `20260911122000_drop_ship_sahkan_nota.sql`
- Pemantau: `supabase/verifikasi/drop_ship/pemantau.sql`
- Memori: `drop-ship-sayur-pak-aziz.md`
