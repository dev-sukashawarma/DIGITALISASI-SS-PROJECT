# Handoff — Aplikasi Native: Pengeluaran Outlet & Batas Jam Petty Cash Langsung ke Finance

**Tanggal:** 26 Nov 2026 · **Untuk:** pemegang repo aplikasi native
(`SUPER-APPS-SS-MOBILE` = superapp leader/manager, dan repo POS kasir tablet)
**Lanjutan dari:** `docs/HANDOFF-2026-11-25-APP-NATIVE-PETTY-CASH-TANPA-AM.md`
**Migrasi server:** `supabase/migrations/20261126100000_pengeluaran_dan_topup_petty_cash_finance.sql`

---

## 1. Ringkasan Perubahan Kontrak Server

### A. Pengeluaran Outlet POS (`petty_cash_expenses`)
| Aspek | Aturan Baru (26 Nov 2026) |
|---|---|
| Jendela pengajuan (`add_petty_cash`) | **06:00–21:00 WIB**. Di luar jam tersebut (21:00–05:59 WIB) server menolak dengan pesan: `"Pengajuan pengeluaran outlet hanya dapat dilakukan pukul 06:00 hingga 21:00 WIB."` |
| Wewenang ACC / Tolak (`review_petty_cash_expense`) | **Finance** (`admin_finance`, `admin`, `owner`, `developer`). Role `area_manager` kini ditolak oleh RPC. |
| Wewenang koreksi kategori (`ubah_kategori_pengeluaran_petty_cash`) | **Finance** (`admin_finance`, `admin`, `owner`, `developer`). Role `area_manager` kini ditolak oleh RPC. |
| Tutup shift POS | Tetap dikunci selama masih ada pengeluaran `status = 'pending'`. Pesan error DB kini menyebut **Finance** (bukan AM). |
| Void oleh kasir (`void_petty_cash_expense`) | Tetap berlaku untuk `pending` dan `approved`. Pesan error untuk status `rejected` kini menyebut **Finance**. |
| Push notifikasi saat pengeluaran baru | Tetap dikirim ke **AM binaan** (`app: manager`, `url: manager_petty_cash_pengeluaran`) sebagai **INFO pantauan saja** (judul `"Info Pengeluaran Outlet · <Outlet>"`, isi `"… Sedang menunggu ACC Finance."`), sekaligus dikirim ke `admin_finance` (`app: finance`, `url: https://finance.sukashawarma.com/approval`). |

### B. Top-Up Petty Cash (`petty_cash_topups`)
| Aspek | Aturan Baru (26 Nov 2026) |
|---|---|
| Alur status | Tetap tanpa AM: Leader ajukan (`forwarded_to_finance`) → Finance cairkan + bukti (`approved_by_finance`) → Leader konfirmasi masuk laci (`forwarded_by_leader`). |
| Jendela pengajuan (`create_petty_cash_topup`) | **09:00–16:00 WIB**. Di luar jam tersebut server menolak dengan pesan: `"Pengajuan top up petty cash hanya dibuka pukul 09:00 hingga 16:00 WIB."` |
| Auto-batal pukul 16:00 WIB | `pg_cron` (`petty-cash-topup-auto-batal-16wib`, `0 9 * * *` UTC = 16:00 WIB) membatalkan otomatis semua pengajuan berstatus `forwarded_to_finance` menjadi `rejected` dengan alasan `[Ditolak Finance: Dibatalkan otomatis oleh sistem karena melewati batas pukul 16:00 WIB]`. Guard yang sama juga menolak `approve` Finance bila lewat 16:00 WIB. Baris `approved_by_finance` (sudah ditransfer, menunggu konfirmasi Leader) **tidak** dibatalkan. |
| Push notifikasi | 1) Pengajuan baru → info pantauan ke **AM binaan** (`app: manager`, `url: manager_petty_cash`) + permintaan ACC ke `admin_finance` (`app: finance`).<br>2) Auto-batal jam 16:00 → push ke **Leader pengaju** (`app: leader`, `type: petty_cash_cancelled`, `url: leader_petty_cash`).<br>3) Sudah ditransfer Finance → tetap push ke Leader pengaju (`type: petty_cash_urgent`). |

---

## 2. Yang Harus Diubah di Superapp Android (`SUPER-APPS-SS-MOBILE`)

### Modul Manager (Area Manager = pantauan read-only saja)
1. `feature/manager/.../ui/pettycash/` (panel Pengeluaran Kasir):
   - **Buang tombol ACC, Tolak, dan Ubah Kategori** beserta panggilan ke `review_petty_cash_expense` dan `ubah_kategori_pengeluaran_petty_cash` (karena RPC kini menolak `area_manager`).
   - Pertahankan daftar pengeluaran `pending` + tombol lihat struk sebagai **pantauan read-only** dengan label status `"Menunggu ACC Finance"`.
2. `feature/manager/.../data/PettyCashRepository.kt`:
   - Hapus/nonaktifkan pemanggilan `tinjauPengeluaran` & `ubahKategoriPengeluaran` dari UI Manager.
3. Notifikasi `manager_petty_cash_pengeluaran` dan `manager_petty_cash`:
   - Tetap membuka layar pantauan Petty Cash Manager (sekarang berfungsi sebagai info pantauan).

### Modul Leader
4. Form pengajuan Top-Up Petty Cash (`feature/leader/.../ui/pettycash/PettyCashScreen.kt`):
   - Tambahkan validasi jam WIB **09:00–16:00 WIB** di UI: tampilkan info jam buka + keterangan bahwa pengajuan yang belum diproses lewat pukul 16:00 WIB akan dibatalkan otomatis oleh sistem, dan nonaktifkan tombol kirim di luar jam 09:00–16:00 WIB.
   - Tampilkan pesan galat dari server apa adanya jika user tetap memicu submit di batas waktu.
5. Notifikasi `type = petty_cash_cancelled` (`url = leader_petty_cash`):
   - Pastikan tap notifikasi membuka layar Petty Cash Leader agar Leader bisa melihat status `Ditolak` + alasan auto-batal 16:00 WIB.

*(Seluruh perubahan handoff 25 Nov 2026 tentang `approved_by_finance` → tombol "Dana diterima & masuk laci" tetap wajib diterapkan bersamaan.)*

---

## 3. Yang Harus Diubah di POS Kasir Native (Tablet)

Acuan implementasi web ada di `apps/pos-kasir/app/kasir/shift/page.tsx` dan `apps/pos-kasir/app/kasir/shift/close/page.tsx`:
1. **Batas jam pengajuan pengeluaran (06:00–21:00 WIB):**
   - Tampilkan banner informasi batas maksimal **21:00 WIB** dan nonaktifkan tombol "Ajukan Pengeluaran" pada pukul **21:00–05:59 WIB** (gunakan zona waktu `Asia/Jakarta`).
   - Server (`add_petty_cash`) juga menolak di luar jam tersebut — tampilkan pesan error dari server secara jelas.
2. **Perbarui teks label AM → Finance:**
   - Ganti seluruh teks `"Menunggu Approval AM"`, `"Disetujui AM"`, `"Ditolak AM"`, `"Hubungi AM outlet Anda"` menjadi **Finance** (`"Menunggu Approval Finance"`, `"Disetujui Finance"`, `"Ditolak Finance"`, `"Hubungi tim Finance"`).
3. **Tutup shift:**
   - Tetap terkunci jika `pending_expenses_count > 0` dari `get_petty_cash_snapshot`, dengan pesan mengarah ke **Finance**.

---

## 4. Checklist Pengujian
1. **Top-up di luar 09:00–16:00 WIB:** tombol nonaktif di UI & RPC `create_petty_cash_topup` menolak.
2. **Top-up masuk sebelum 16:00 WIB lalu dibiarkan sampai 16:00 WIB:** `pg_cron` membatalkan otomatis (`status = 'rejected'`), hilang dari Hub Approval Finance, tercatat di Riwayat Approval, dan Leader menerima push pemberitahuan.
3. **Pengeluaran POS lewat 21:00 WIB (atau sebelum 06:00 WIB):** tombol nonaktif di UI & RPC `add_petty_cash` menolak.
4. **Pengeluaran POS antara 06:00–21:00 WIB:** masuk Hub Approval Finance (kartu `Pengeluaran PC`), AM binaan menerima push info (tanpa tombol ACC di Manager), Finance dapat koreksi kategori di modal lalu ACC/Tolak.
5. **Outlet RAB otomatis (mis. Mitra Karawaci):** pengeluaran `pending`/`rejected` tidak ikut terhitung di Biaya RAB sampai berstatus `approved`.
