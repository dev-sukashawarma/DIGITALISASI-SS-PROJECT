# Rencana Uji E2E Manual — Hulu ke Hilir, Semua Role

**Tanggal:** 2026-07-06 · **Penguji:** manusia (bukan otomasi) · **Scope:** semua app web. **EXCLUDE:** semua yang berkaitan mobile (`mobile/native-superapp`, `mobile/native-pos`, `mobile/pos-mobile`, desain Stitch SUPERAPP SS).

**Cara pakai:** kerjakan skenario berurutan S0 → S10 (alurnya menyambung: barang yang dibeli di S1 adalah barang yang dikirim di S2, dst). Isi kolom **Hasil** dengan ✅ PASS / ❌ FAIL / ⏭️ SKIP + catatan. Setiap FAIL dicatat dengan format bug report di bagian paling bawah.

---

## 1. Lingkungan Uji

| App | Lokal (dev) | Produksi | Status |
|---|---|---|---|
| Portal (login SSO) | http://localhost:3010 | portal.sukashawarma.com (cek) | — |
| Stok | http://localhost:3001 | https://stok.sukashawarma.com | ✅ LIVE |
| Distribusi | http://localhost:3002 | https://distribusi.sukashawarma.com | ✅ LIVE |
| Absensi | http://localhost:3006 (`yarn next dev -p 3006`, default 3001 bentrok dgn stok) | https://absensi.sukashawarma.com | ✅ LIVE |
| Owner Dashboard | http://localhost:3003 | — | — |
| Admin Dashboard | http://localhost:3005 | (perlu redeploy — cek dulu) | ⚠️ |
| POS Kasir | http://localhost:3004 | (cek deployment) | ⚠️ |

**Rekomendasi:** uji di **lokal dev** dengan database Supabase remote (kondisi paling lengkap & terbaru), KECUALI skenario absensi kamera (S9) yang lebih realistis diuji di HP/tablet via URL produksi. Kalau uji di produksi, pastikan versi ter-deploy sudah memuat fix terbaru (beberapa sesi mencatat "perlu redeploy").

⚠️ **Data:** database remote dipakai bersama dengan operasional nyata. SEMUA data uji wajib pakai prefix `E2E ` (outlet, bahan, menu, nama staff) supaya gampang dikenali & dibersihkan. Jangan pernah menyentuh data outlet nyata.

⚠️ **WAJIB uji build produksi, bukan hanya `yarn dev`.** Pengalaman terdokumentasi (sesi 2026-06-25): bug RSC 500 di route detail **hanya muncul di build produksi** karena dev server selalu dynamic. Kalau uji lokal, jalankan `yarn build && yarn start` per app (atau uji langsung di subdomain produksi). Minimal: seluruh S0 + halaman detail (ledger/opname/monitoring-live drill-down) harus dicoba di build prod.

---

## 2. Persiapan Data Uji (sekali di awal)

Dilakukan oleh admin/dev via Supabase Dashboard + UI app:

- [ ] **P-01** Buat 2 outlet uji: `E2E Outlet A`, `E2E Outlet B` (tabel `outlets`).
- [ ] **P-02** Buat akun uji per role (auth user + baris `outlet_staff`). Password seragam, catat di tabel bawah. `leader` di-map ke outlet A **dan** B via `staff_outlets` (many-to-many).
- [ ] **P-03** Buat 3 bahan baku uji: `E2E Daging Shawarma` (kg), `E2E Roti Pita` (pcs), `E2E Saus Garlic` (satuan majemuk **kompan**, isi faktor_tampilan — untuk uji tampilan kompan+liter).
- [ ] **P-04** Buat 1 supplier uji `E2E Supplier` (admin-dashboard → Pembelian → Supplier).
- [ ] **P-05** Buat 1 menu POS `E2E Shawarma Original` + resep/BOM (daging 0.1 kg, roti 1 pcs) via admin-dashboard → Resep.
- [ ] **P-06** Daftarkan `E2E Outlet A` ke **allowlist BOM** (trigger auto-deduct per-outlet — tanpa ini S6 pasti gagal; cek tabel allowlist di migration `20260703000000_bom_automation.sql`).
- [ ] **P-07** Set reorder point (ORP) item uji di outlet A & B (untuk uji status monitoring & transfer suggestion): mis. daging ORP 5 kg, roti ORP 50 pcs.
- [ ] **P-08** Set `outlet_attendance_config` untuk `E2E Outlet A`: jam masuk/keluar shift + mode `auto` (untuk S9).

**Tabel akun uji** (isi saat P-02; login username tanpa `@` otomatis jadi `<username>@outlet.local`):

| Role | Email/Username | Password | Outlet | Dibuat? |
|---|---|---|---|---|
| admin | admin.e2e@test.com | | — (semua) | ☐ |
| admin_hr | adminhr.e2e@test.com | | — | ☐ |
| owner | owner.e2e@test.com | | — | ☐ |
| spv | spv.e2e@test.com | | — (semua) | ☐ |
| leader | leader.e2e@test.com | | A + B (staff_outlets) | ☐ |
| crew (A) | crew.e2e@test.com | | E2E Outlet A | ☐ |
| crew (B) | crewb.e2e@test.com | | E2E Outlet B | ☐ |
| kiosk | kiosk.e2e@test.com | | E2E Outlet A | ☐ |
| kitchen | kitchen.e2e@test.com | | outlet Kitchen (yang sudah ada) | ☐ |
| mitra | mitra.e2e@test.com | | E2E Outlet A | ☐ |
| staff_pusat | pusat.e2e@test.com | | Kantor Pusat (auto) | ☐ |

> Role `kasir` di dokumen lama sudah tidak ada di sistem — tugas kasir dipegang role `crew` di POS.

---

## 3. S0 — Login, Logout & Matriks Akses (semua role)

### S0-A. Login & logout

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| A-01 | Login tiap akun di tabel §2 (11 akun) via portal/halaman login | Semua berhasil masuk; mendarat di halaman sesuai role (admin → admin-dashboard; crew → dashboard crew; dst) | |
| A-02 | Login `crew.e2e@test.com` dengan password salah | Ditolak dengan pesan error jelas; tidak masuk | |
| A-03 | Login email yang tidak terdaftar | Ditolak; tidak ada info bocor (mis. "email tidak ada" vs "password salah" boleh generik) | |
| A-04 | Setelah login di satu app, buka app lain yang di-grant (tanpa login ulang) | SSO jalan — langsung masuk tanpa diminta login lagi | |
| A-05 | Klik "Keluar" di app mana pun | Session berakhir; dilempar ke login; back-button tidak membuka halaman ber-data | |

### S0-B. Matriks akses role × app

Uji dengan **membuka URL app langsung** (bukan lewat launcher) saat login sebagai role tsb. ✅ = harus bisa masuk; ⛔ = harus ditolak (redirect ke login/launcher/dashboard default — yang penting konten app TIDAK termuat). Sumber kebenaran: `packages/auth/src/access.ts`.

| Role | pos-kasir | absensi | stok | distribusi | owner-dash | admin-dash | Hasil |
|---|---|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| admin_hr | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ✅ | |
| owner | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ | |
| spv | ⛔ | ✅ | ✅ | ✅ | ⛔ | ⛔ | |
| leader | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | |
| crew | ✅ | ✅ | ✅ | ✅ | ⛔ | ⛔ | |
| kiosk | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | |
| kitchen | ⛔ | ⛔ | ✅ | ✅ | ⛔ | ⛔ | |
| mitra | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | |
| staff_pusat | ⛔ | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | |

= **66 cek** (11 login + 55 sel matriks; kolom Hasil diisi per baris, catat sel yang meleset).

---

## 4. S1 — HULU: Purchase Order Supplier → Kitchen

**Role pelaku:** admin (admin-dashboard → `/dashboard/pembelian`).

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| PO-01 | Buat PO baru: supplier `E2E Supplier`, item `E2E Daging Shawarma` 10 kg | PO tersimpan, muncul di daftar dengan status awal yang benar | |
| PO-02 | Coba submit PO **tanpa item** | Form menolak (tombol disabled / pesan validasi) | |
| PO-03 | Proses PO sampai status **diterima di kitchen** (ikuti alur di `docs/FLOWS.md`) | Status berubah sesuai state machine; tidak bisa loncat status | |
| PO-04 | Cek stok kitchen untuk `E2E Daging Shawarma` (app stok, akun kitchen, atau monitoring SPV) | Saldo kitchen **naik 10 kg** — angka pasti, bukan kira-kira | |
| PO-05 | Buka laporan pembelian (`/dashboard/pembelian/laporan`) | PO tadi terhitung di laporan periode berjalan | |
| PO-06 | Login **mitra**, buka URL `/dashboard/pembelian` langsung | Ditolak/redirect — mitra tidak boleh lihat pembelian | |

---

## 5. S2 — Surat Jalan Kitchen → Terima di Outlet

**Role pelaku:** kitchen (buat SJ) + crew A (terima) + crew B (uji isolasi). App: distribusi.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| SJ-01 | Login **kitchen** → buat Surat Jalan baru ke `E2E Outlet A`: daging 5 kg, roti 100 pcs | SJ tersimpan dengan nomor; stok kitchen berkurang sesuai (atau saat dikirim, ikut aturan flow) | |
| SJ-02 | Login **crew A** → menu Terima | SJ dari SJ-01 muncul di daftar | |
| SJ-03 | Terima **penuh** SJ tsb | Sukses; di app stok: ledger `terima_kiriman` +5 kg daging & +100 pcs roti; saldo outlet A naik persis segitu | |
| SJ-04 | (Kitchen) buat SJ kedua: daging 5 kg → (crew A) terima **hanya 3 kg** (selisih 2) | Selisih tercatat sebagai `rejected_kiriman` 2 kg; saldo outlet A hanya naik 3 kg | |
| SJ-05 | Login **crew B** → menu Terima | SJ milik outlet A **tidak terlihat** (RLS per outlet) | |
| SJ-06 | Buka Riwayat (`/distribusi/riwayat`) sebagai kitchen | Kedua SJ muncul dengan status akhir benar | |
| SJ-07 | (Crew A) coba terima ulang SJ yang sudah selesai | Tidak bisa — tidak ada dobel-terima / dobel ledger | |

---

## 6. S3 — Permintaan Bahan (crew → SPV)

**App:** stok → `/stok/permintaan`.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| PM-01 | Login **crew A** → buat permintaan `E2E Roti Pita` 20 pcs | Tersimpan status menunggu/pending | |
| PM-02 | Login **SPV** → buka permintaan → **Approve** PM-01 | Status jadi disetujui; terlihat juga di sisi crew | |
| PM-03 | Crew A buat permintaan kedua (5 pcs) → SPV **Tolak** | Status ditolak + (bila ada) alasan tampil ke crew | |
| PM-04 | Login **crew B** → buka halaman permintaan | Permintaan outlet A **tidak terlihat** | |
| PM-05 | Crew A submit permintaan dengan qty 0/kosong | Form menolak | |

---

## 7. S4 — Ledger Manual (pemakaian, waste, adjustment)

**Role pelaku:** crew A. App: stok → `/stok/ledger/new`.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| LG-01 | Entri **Pemakaian** daging 1 kg | Tersimpan; saldo daging outlet A berkurang 1; muncul di daftar ledger | |
| LG-02 | Entri **Waste** roti 2 pcs | Tersimpan sebagai outflow; saldo berkurang 2 | |
| LG-03 | Entri **Penyesuaian (adjustment)** dengan nilai **NEGATIF** (mis. −2) | **HARUS BISA disubmit** (regresi fix 2026-06-25: dulu tombol disabled) dan saldo berkurang 2 | |
| LG-04 | Entri Penyesuaian nilai **0** | Ditolak (≠ 0 wajib) | |
| LG-05 | Entri Waste dengan nilai negatif/0 | Ditolak (waste wajib > 0) | |
| LG-06 | Entri pemakaian `E2E Saus Garlic` lalu lihat daftar ledger | Tampilan satuan majemuk benar: `X kompan Y liter` sesuai faktor_tampilan (fitur 2026-07-06) | |
| LG-07 | Buka detail salah satu entri ledger dari daftar | Halaman detail terbuka normal (regresi RSC 500 di build produksi, fix 2026-06-25) | |
| LG-08 | (Jika POS sudah jalan) cek ledger setelah 1 order POS | Pemakaian bahan dari 1 order tampil **1 card per order** (grouping 2026-07-06), bukan tercecer per bahan | |

---

## 8. S5 — Opname → Selisih

**Role pelaku:** crew A. App: stok → `/stok/opname/new`.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| OP-01 | Catat saldo sistem roti (misal N). Buat opname dengan fisik = N − 3 | Opname tersimpan; ledger `opname_selisih` −3; saldo sistem terkoreksi jadi N − 3 | |
| OP-02 | Opname dengan fisik = saldo sistem (selisih 0) | Tersimpan tanpa menciptakan koreksi liar | |
| OP-03 | Input composite `E2E Saus Garlic`: isi remainder **≥ faktor_tampilan** (mis. 1 kompan 25 liter saat faktor 20) | **Diterima** dan terkonversi benar (regresi fix `9e1fb8fb`) | |
| OP-04 | Buka detail opname dari daftar `/stok/opname` | Halaman detail render normal, riwayat item benar | |

---

## 9. S6 — POS Checkout → Potong Stok Otomatis (BOM)

**Role pelaku:** crew A (kasir) + kiosk. App: pos-kasir. **Prasyarat:** P-05 (menu+resep) & P-06 (allowlist BOM outlet A).

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| PS-01 | Login **crew A** → kasir → order 1× `E2E Shawarma Original` → checkout tunai | Order sukses, struk/konfirmasi muncul | |
| PS-02 | Cek app stok (ledger outlet A) beberapa detik setelah PS-01 | Ledger `pemakaian` otomatis: daging −0.1 kg & roti −1 pcs (angka pasti sesuai resep) | |
| PS-03 | Order menu **tanpa resep** (buat 1 menu polos dulu bila belum ada) → checkout | Order sukses; **tidak ada** ledger stok baru | |
| PS-04 | Order 3× shawarma dalam 1 transaksi | Deduction terkali-3 (daging −0.3, roti −3) | |
| PS-05 | Login **kiosk** di device lain → mode kiosk → order self-service | Alur kiosk jalan sampai sukses; kiosk tidak bisa keluar dari POS ke app lain (lihat S0-B) | |
| PS-06 | Buka Histori (`/kasir/histori`) | Semua order E2E hari ini tercatat benar | |
| PS-07 | Cek dashboard admin: laporan penjualan hari ini | Omzet order E2E masuk (dipakai lagi di S10) | |

---

## 10. S7 — Monitoring (crew & SPV)

**App:** stok.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| MO-01 | Login **crew A** → `/dashboard` | Item E2E outlet A tampil dengan saldo terkini (hasil semua skenario di atas) | |
| MO-02 | Klik salah satu item → modal detail | Modal terbuka **tanpa error boundary "Oops!"** (regresi alias `type/notes`, fix 2026-06-25); riwayat pergerakan tampil dengan tipe & catatan terbaca | |
| MO-03 | Login **SPV** → `/stok/monitoring-live` | Papan menampilkan outlet-outlet termasuk `E2E Outlet A` & `B`; panel Kitchen tampil | |
| MO-04 | Klik card `E2E Outlet A` | Masuk halaman detail per outlet (`/stok/monitoring-live/[outlet-id]`) dengan breakdown item | |
| MO-05 | Buat kondisi kritis: pakai ledger/opname sampai saldo daging outlet A **di bawah ORP** (P-07) | Status item berubah **below/kritis** di monitoring crew & SPV; jika masuk Top-3 kritis, tampil di section atas | |
| MO-06 | Naikkan saldo lagi di atas ORP (adjustment +) | Status kembali ok/warning sesuai threshold | |
| MO-07 | Login **leader** → dashboard stok | Hanya outlet binaan (A & B) yang terlihat; outlet nyata lain (mis. Empang) **tidak** tampil | |

---

## 11. S8 — Transfer Antar-Outlet Suggestion

⚠️ Modul ini **masih WIP** di working tree (`TransferSuggestionPanel`, `transferSuggestion.ts`). Uji HANYA setelah modul merge & deploy — kalau belum, tandai seluruh section ⏭️ SKIP.

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| TF-01 | Kondisikan: outlet A surplus daging (jauh di atas ORP), outlet B defisit (di bawah ORP) | Panel suggestion menampilkan usulan transfer A → B untuk daging, dengan qty masuk akal | |
| TF-02 | Kondisikan kedua outlet sehat (di atas ORP) | Panel kosong / empty state, bukan error | |
| TF-03 | (Bila aksi transfer sudah ada) eksekusi transfer sesuai suggestion | Ledger `transfer_keluar` di A dan `transfer_masuk` di B dengan qty sama | |

---

## 12. S9 — Absensi (termasuk kamera — keunggulan uji manusia)

**App:** absensi. **Prasyarat:** P-08. Uji kamera paling realistis via HP/tablet di URL produksi.

### S9-A. Manajemen kru & enrollment

| ID | Role | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|---|
| AB-01 | spv | Manajemen Kru → buat akun crew baru `E2E Crew Baru` (username unik) | Akun terbuat, muncul di daftar staff outlet A | |
| AB-02 | spv | `/dashboard/enroll` → daftarkan wajah crew baru: centang consent UU PDP → capture **3 frame frontal** | Enrollment sukses; staff pindah ke section "Sudah Terdaftar" | |
| AB-03 | spv | Enroll **tanpa** mencentang consent | Tidak bisa lanjut | |
| AB-04 | spv | **Enroll Ulang** staff yang sudah terdaftar (isi alasan) | Konfirmasi timpa muncul; audit `re_enrolled_at/by/reason` terisi (cek DB) | |
| AB-05 | crew | Buka URL `/dashboard/enroll` langsung | **Diblokir/redirect** — halaman khusus SPV/leader | |
| AB-06 | leader | Buka `/dashboard/enroll` | Bisa masuk | |

### S9-B. Clock in/out & face match (kalibrasi threshold cosine 0.725)

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| AB-07 | Crew ter-enroll absen di kiosk `E2E Outlet A` **dengan wajahnya sendiri**, dalam window | Liveness 2-fase (gerakan → kembali frontal) → dikenali, clock-in sukses, status ON_TIME/LATE sesuai jam | |
| AB-08 | **Orang lain** (belum/beda enroll) mencoba absen di panel pribadi akun crew tsb (mode 1:1) | **DITOLAK** dengan pesan jelas — wajah B tidak bisa absen untuk akun A | |
| AB-09 | Foto wajah dari layar HP diarahkan ke kamera (spoof) | Liveness menolak (tidak lolos tanpa gerakan hidup) | |
| AB-10 | Absen **di luar window** (mode auto: >1 jam sebelum jam masuk) | Overlay "Belum Waktunya Absen" + jam buka; scan tidak jalan | |
| AB-11 | SPV set **Emergency Lock** (is_active off, mode auto) | Kiosk menampilkan overlay terkunci | |
| AB-12 | SPV ganti mode outlet ke **manual**, toggle Status Kiosk off/on | Off → overlay "Outlet Ditutup"; on → bisa absen kapan pun (window diabaikan) | |
| AB-13 | Clock-out < 30 menit sebelum jam keluar (mode auto) | Diizinkan; lebih awal dari itu ditolak `too_early_out` | |

### S9-C. Rekap & pendukung

| ID | Role | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|---|
| AB-14 | spv | Papan kehadiran & rekap tanggal hari ini | Clock-in AB-07 muncul dengan status benar | |
| AB-15 | crew | Dashboard kru → riwayat pribadi | Hanya data dirinya sendiri | |
| AB-16 | staff_pusat | Login → app absensi | Masuk normal (outlet Kantor Pusat); tidak bisa buka app lain (S0-B) | |
| AB-17 | crew | Smoke: checklist, cuti, kasbon | Halaman terbuka tanpa error; submit satu item sukses | |

---

## 13. S10 — HILIR: Reporting & Isolasi Dashboard

**App:** admin-dashboard (+ owner-dashboard smoke). **Prasyarat:** S6 sudah menghasilkan penjualan.

| ID | Role | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|---|
| RP-01 | owner | `/dashboard/owner` filter `E2E Outlet A` hari ini | Omzet = total order S6 (angka cocok dengan histori POS) | |
| RP-02 | owner | Input Pengeluaran: expense **Outlet** utk A + expense **Pusat** | Keduanya tersimpan; kartu "Biaya Pusat" hanya muncul saat filter "Semua Outlet" | |
| RP-03 | admin | Buka form input pengeluaran | Opsi scope **Pusat tidak tersedia** (owner-only) | |
| RP-04 | owner | Halaman Profit | Laba Outlet (exclude biaya pusat) vs Laba Perusahaan (include) keduanya tampil & konsisten dgn RP-02 | |
| RP-05 | mitra | Login → dashboard | Hanya grup "Dashboard Mitra" (4 menu: owner, targets, profit, expenses) | |
| RP-06 | mitra | Perhatikan filter outlet | Label statis `E2E Outlet A` — bukan dropdown; **tidak ada** nama outlet lain di mana pun (leaderboard, chart) | |
| RP-07 | mitra | Halaman targets | Read-only: tidak ada tombol Set Target / input / Save | |
| RP-08 | mitra | Buka URL `/dashboard/hr`, `/dashboard/pembelian`, `/dashboard/system-health` langsung | Semua redirect balik ke `/dashboard/owner` | |
| RP-09 | admin_hr | Login → admin-dashboard | Hanya menu HR yang relevan; halaman HR (staff, attendance, leave, payroll) terbuka | |
| RP-10 | admin | `/dashboard/system-health` | Terbuka utk admin; login role lain (owner) → tidak bisa | |
| RP-11 | admin | Laporan shrinkage (`/dashboard/reports/shrinkage`) | Waste (LG-02) & selisih opname (OP-01) outlet A terhitung | |
| RP-12 | owner | owner-dashboard (:3003) smoke | Dashboard, expenses, profit terbuka tanpa error | |

---

## 14. S11 — Simulasi Hari Operasional Nyata (real case)

**Tujuan:** bukan menguji fitur satu-satu, tapi memerankan **satu hari kerja outlet dari buka sampai tutup** dengan beberapa orang memegang role berbeda secara **bersamaan**, persis pola pemakaian nyata. Dikerjakan SETELAH S0–S10 lulus (fitur dasar terbukti jalan dulu).

**Pemeran minimal:** 3 orang — Penguji-1 (kitchen + admin + owner di PC), Penguji-2 (crew A: kasir + stok + absensi di PC/HP), Penguji-3 (SPV di PC + wajah kedua utk uji absensi). TV/monitor kedua membuka monitoring-live sepanjang simulasi.

### Skrip kronologis (ikuti urutan jam; boleh dipadatkan, jeda antar-babak ±10 mnt)

| ID | "Jam" | Pemeran | Adegan | Hasil diharapkan | Hasil |
|---|---|---|---|---|---|
| RC-01 | 07:00 | Admin | Buat PO pagi ke `E2E Supplier` utk restock kitchen, proses sampai diterima | Stok kitchen siap utk hari ini | |
| RC-02 | 08:00 | Kitchen | Buat 1 surat jalan kiriman pagi ke outlet A (daging + roti + saus, qty realistis 1 hari jualan) | SJ terkirim | |
| RC-03 | 08:30 | Crew A | **Clock-in wajah** di kiosk absensi (dalam window) → lalu terima kiriman SJ pagi | Absen ON_TIME; saldo outlet A terisi utk jualan | |
| RC-04 | 09:00 | SPV | Lihat papan kehadiran (crew sudah masuk) + monitoring-live (stok outlet A hijau) | Kondisi pagi sehat terbaca dari 2 papan | |
| RC-05 | 10:00–12:00 | Crew A + Kiosk | **Jam sibuk:** 10 order POS beruntun secepat mungkin, CAMPUR: kasir 6 order (ada yang 2–3 item) + device kiosk 4 order self-service **berjalan bersamaan** | Semua order sukses tanpa nyangkut; tidak ada order hilang/dobel di histori | |
| RC-06 | 12:05 | Penguji-1 | Cek ledger outlet A setelah jam sibuk | Deduction BOM = akumulasi persis 10 order (hitung manual total daging/roti); 1 card per order, tidak ada selisih | |
| RC-07 | 12:30 | Crew A | Insiden nyata: roti jatuh 3 pcs → entri **Waste**; stok saus menipis → buat **Permintaan Bahan** | Keduanya tercatat; permintaan pending | |
| RC-08 | 13:00 | SPV | Dari HP: approve permintaan RC-07 sambil memantau monitoring | Approve dari perangkat berbeda jalan | |
| RC-09 | 14:00 | Kitchen | Kirim SJ susulan (saus) → Crew A terima **dengan selisih** (kirim 5, terima 4, 1 tumpah) | `rejected_kiriman` 1 tercatat; saldo naik 4 | |
| RC-10 | 15:00 | Monitor TV | Papan monitoring-live sudah terbuka ±5 jam tanpa reload | Data tetap segar (auto-refresh), tidak memutih/crash/logout sendiri | |
| RC-11 | 17:00 | Crew A | Jualan sore 5 order lagi sampai **daging menembus di bawah ORP** | Monitoring berubah kritis; masuk Top-3 papan SPV | |
| RC-12 | 21:00 | Crew A | Tutup toko: **opname malam** semua item E2E (buat 1 item sengaja selisih −1) | `opname_selisih` tercatat; saldo terkoreksi | |
| RC-13 | 21:15 | Crew A | **Clock-out** wajah (dalam window keluar) | Status pulang tercatat benar | |
| RC-14 | 21:30 | Owner | Review malam: omzet hari ini (= 15 order), profit, shrinkage (waste RC-07 + selisih RC-09/RC-12) | Semua angka laporan **rekonsiliasi persis** dengan kejadian hari ini — hitung manual, jangan dikira-kira | |
| RC-15 | 21:45 | Mitra | Buka dashboard dari HP | Melihat performa outlet A hari ini saja; tak ada bocoran outlet lain | |

### Kasus kondisi lapangan (chaos cases — selipkan saat simulasi berjalan)

| ID | Adegan | Hasil diharapkan | Hasil |
|---|---|---|---|
| RC-16 | Saat checkout POS, **matikan WiFi** device tepat setelah tekan bayar → nyalakan lagi | Order tidak hilang & tidak dobel (offline-queue/retry); kalau gagal, ada pesan jelas & bisa diulang aman | |
| RC-17 | Dua device kasir & kiosk order **item terakhir yang sama** hampir bersamaan (stok mepet) | Tidak ada saldo minus liar / dua-duanya lolos tanpa kontrol; perilaku konsisten | |
| RC-18 | SPV dan Leader membuka **permintaan yang sama**, dua-duanya tekan Approve hampir bersamaan | Hanya satu approve efektif; tidak dobel status/dobel efek | |
| RC-19 | Crew refresh browser **di tengah mengisi** form opname/ledger sebelum submit | Tidak ada data setengah-tersimpan; form kembali bersih atau draft jelas | |
| RC-20 | Crew tekan tombol submit ledger **2× cepat** (double-tap) | Hanya 1 entri tercatat | |
| RC-21 | Session dibiarkan idle >1 jam lalu langsung dipakai submit | Tidak silent-fail: entah sukses (token refresh) atau diminta login ulang dengan jelas | |
| RC-22 | Buka app di HP (browser mobile) utk alur crew: terima SJ, entri ledger, absen | Layout tetap bisa dipakai (tombol terjangkau, tabel tidak terpotong fatal) | |

> RC-22 = uji **responsive web di browser HP** — ini tetap in-scope karena bukan aplikasi mobile native (yang native di-exclude).

---

## 15. S12 — Keamanan Lapis Data (RLS langsung, bukan cuma UI)

**Kenapa perlu:** S0 hanya membuktikan **UI** menolak. Sistem ini bertumpu pada RLS — siapa pun bisa buka DevTools dan query PostgREST langsung pakai session token miliknya sendiri. Kalau RLS bolong, data bocor walau UI rapi. Ini babak pembeda "kelihatan aman" vs "aman".

**Cara ambil token:** login sebagai role ybs → DevTools → Application → Cookies/LocalStorage → cari `sb-...-auth-token` → salin `access_token`. Lalu tembak REST dari terminal:

```bash
curl "https://<project-ref>.supabase.co/rest/v1/<tabel>?select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ACCESS_TOKEN_ROLE>"
```

| ID | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|
| SEC-01 | Token **crew B** → query `ledger_stok` difilter `outlet_id` outlet A | **Kosong** (RLS `ledger_read` menyaring), bukan data outlet A | |
| SEC-02 | Token **crew B** → query `permintaan` & `surat_jalan` outlet A | Kosong | |
| SEC-03 | Token **crew A** → coba `POST`/`PATCH` `ledger_stok` untuk outlet B | Ditolak RLS | |
| SEC-04 | Token **mitra** → query view **unscoped** (`sales_hourly_spv`, `menu_sales_spv`) langsung | Ditolak/kosong — mitra hanya boleh via view `*_scoped`; `accessible_outlet_ids()` menahan di DB | |
| SEC-05 | Token **mitra** → panggil RPC `upsert_expense` scope **pusat** | Ditolak (pusat = owner-only di DB, bukan cuma disembunyikan di form RP-03) | |
| SEC-06 | Token **spv** (non-admin) → query view `system_health_*` | Ditolak (`is_admin()` only; view wajib `security_invoker=true`) | |
| SEC-07 | Token role apa pun → RPC `_svc` permintaan (buat/approve) utk outlet bukan haknya | Server action validasi identitas — tak bisa approve lintas outlet | |
| SEC-08 | **Tanpa token** (anon key saja) → query `outlet_staff`, `ledger_stok`, `orders` | Ditolak/kosong — tidak ada tabel telanjang utk anon | |
| SEC-09 | crew isi field catatan ledger/permintaan `<script>alert(1)</script>` → buka di monitoring SPV | Ter-escape sebagai teks, TIDAK tereksekusi (no stored XSS) | |
| SEC-10 | Setelah **logout**, replay request lama (token dari history/network) | Ditolak — token tak berlaku | |

---

## 16. S13 — Fitur Operasional yang Belum Tersentuh

S1–S11 fokus alur inti stok/POS/absensi. Fitur berikut ada di route tapi belum diuji — smoke + happy path:

| ID | App / Role | Fitur | Hasil diharapkan | Hasil |
|---|---|---|---|---|
| OF-01 | pos-kasir / crew | **Shift kasir** (`/kasir/shift`): buka shift → transaksi → tutup + hitung kas | Saldo awal → transaksi → saldo akhir cocok; laporan shift benar | |
| OF-02 | pos-kasir / crew | **Order manual** (`/kasir/order-manual`) walk-in | Order tercatat, struk keluar | |
| OF-03 | admin-dash / admin | **Void** transaksi (`/dashboard/reports/voids`) | Void tercatat & terpisah dari penjualan bersih; stok kembali bila berlaku | |
| OF-04 | admin-dash / admin | **Promo** (`/dashboard/pos-admin/promo`) → berlaku di kasir | Harga terpotong sesuai promo saat checkout | |
| OF-05 | admin-dash / admin | **Petty cash** (`/dashboard/pos-admin/petty-cash`) | Kas kecil masuk/keluar tercatat | |
| OF-06 | absensi / crew→spv | **Cuti** (`/dashboard/cuti`): ajukan → approve | Alur pengajuan→approval jalan; muncul di rekap | |
| OF-07 | absensi / crew→spv | **Kasbon** (`/dashboard/kasbon`): ajukan → approve; cek `currentRemaining` | Sisa kasbon terhitung benar (regresi bug remaining) | |
| OF-08 | absensi / crew→spv | **Checklist** harian (`/dashboard/checklist`) + monitor spv | Item tercentang tersimpan; spv lihat di checklist-monitor | |
| OF-09 | admin-dash / owner | **Set target harian** (`/dashboard/owner/targets`) | Target tersimpan; progres muncul di dashboard | |
| OF-10 | admin-dash / owner | **Owner messages** & **push center** | Pesan terkirim/tersimpan | |
| OF-11 | admin-dash / admin | **Panduan** (`/dashboard/panduan/[system_code]`) | Halaman panduan render per sistem | |
| OF-12 | pos-kasir / kiosk | **QR login kiosk** (`/kiosk/qr-login`) | Login via QR jalan; masuk mode kiosk | |
| OF-13 | pos-kasir | **Rekomendasi** (`/recommendations`) + **QRIS** (`/payment/qris`) | Halaman tampil; alur QRIS sampai sukses (atau simulasi) | |

---

## 17. S14 — Batas Waktu, Perangkat & Jaringan

| ID | Kondisi | Langkah | Hasil diharapkan | Hasil |
|---|---|---|---|---|
| BD-01 | **Tengah malam (Asia/Jakarta)** | Transaksi POS 23:58 lalu 00:05 | Masuk hari yang benar di laporan (agregasi zona Asia/Jakarta, bukan UTC) | |
| BD-02 | Rentang tanggal | Laporan owner filter kemarin vs hari ini | Batas hari benar, tidak geser karena timezone | |
| BD-03 | **Browser matrix** | S0 login + 1 alur crew di Chrome, Firefox, Safari iOS, Edge | Jalan di semua; catat yang patah | |
| BD-04 | **Kamera Safari/iOS** | Enroll + clock-in di iPhone Safari | Kamera + liveness jalan (getUserMedia/WebGL beda perilaku di iOS) | |
| BD-05 | **Monitoring TV 1920px** | Buka monitoring-live di layar/emulasi 1920px, tangkap dari ~2–3 m | Readability 3 detik; grid 18 outlet rapi, tidak terpotong | |
| BD-06 | **Koneksi lambat** | DevTools throttle "Slow 3G", buka dashboard & POS | Ada loading state (bukan layar putih); tidak infinite spinner | |
| BD-07 | **Zoom 150%** | Browser zoom di dashboard | Layout tidak pecah fatal | |
| BD-08 | **Dua tab** | App sama di 2 tab, aksi di tab 1, refresh tab 2 | Data konsisten; tak ada state korup antar-tab | |

---

## 18. Pembersihan Setelah Uji

- [ ] C-01 Hapus/void data transaksi E2E: orders POS, ledger, opname, permintaan, surat jalan, PO, attendance (filter `outlet E2E-*` / prefix `E2E `).
- [ ] C-02 Master data (outlet E2E, akun, bahan, menu) **boleh dipertahankan** untuk siklus uji berikutnya — tapi pastikan tidak mengotori laporan manajemen nyata; kalau mengotori, nonaktifkan outlet E2E setelah selesai.
- [ ] C-03 Hapus akun `E2E Crew Baru` (AB-01) atau nonaktifkan.

---

## 19. Format Bug Report

```
ID kasus   : (mis. SJ-04)
Role/akun  : crew.e2e@test.com
Lingkungan : lokal / produksi + browser/device
Langkah    : (urutan persis sampai gagal)
Diharapkan : (dari kolom hasil diharapkan)
Aktual     : (apa yang terjadi + screenshot)
Konsol/network: (error merah di DevTools bila ada)
```

---

## 20. Ringkasan Cakupan

| Role | Skenario yang melibatkan |
|---|---|
| admin | S0, S1 (PO), S10 (shrinkage, system-health, expenses non-pusat) |
| admin_hr | S0, S10 (RP-09) |
| owner | S0, S10 (P&L, expenses pusat) |
| spv | S0, S3 (approve/tolak), S7 (monitoring-live), S8, S9 (pengaturan, kru, enroll) |
| leader | S0, S7 (scope binaan), S9 (enroll allowed) |
| crew A/B | S0, S2 (terima + RLS), S3 (buat + RLS), S4, S5, S6 (kasir), S7, S9 |
| kiosk | S0, S6 (self-service) |
| kitchen | S0, S2 (buat SJ) |
| mitra | S0, S1 (gating), S10 (isolasi penuh) |
| staff_pusat | S0, S9 (AB-16) |

**Total ± 155 kasus:** S0–S10 ±90 (fitur inti) + S11 22 (simulasi hari operasional + chaos) + S12 10 (keamanan RLS) + S13 13 (fitur belum tersentuh) + S14 8 (waktu/perangkat/jaringan). Estimasi: 2–3 penguji × 2–3 hari — hari 1: S0–S10; hari 2: S11 simulasi penuh (S9/S11 kamera butuh 2 orang + HP); hari 3: S12 keamanan + S13 fitur sisa + S14 lintas-perangkat.
