# E2E Test — Role `leader`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **leader**
> (wajib punya ≥1 baris di `staff_outlets`).
> Jobdesk: Leader Outlet — PIC operasional harian **beberapa outlet binaan**.

## Cakupan
leader akses **pos-kasir, absensi, stok, distribusi** — terbatas ke
**outlet binaan** (via `staff_outlets`, ditegakkan RLS). Tidak akses owner/admin.

---

## TC-KO-01 — Login & launcher
- [ ] Login portal → launcher menampilkan: **POS Kasir, Absensi, Stok, Distribusi**.
- [ ] Tidak ada kartu owner-dashboard / admin.

## TC-KO-02 — Scope outlet binaan (penting)
- [ ] `/stok/monitoring` → hanya outlet binaan tampil (BUKAN semua 19).
- [ ] Coba akses data outlet **non-binaan** (mis. ganti id di URL) → ditolak/kosong.

## TC-KO-03 — Stok operasional
- [ ] `/stok/opname/new` → form stock opname muncul.
- [ ] ⚠️ (ubah data) Submit opname uji di outlet binaan test → tersimpan.
- [ ] `/stok/ledger/new` → input pemakaian/waste. ⚠️ (ubah data)
- [ ] `/stok/permintaan` → buat permintaan bahan baku. ⚠️ (ubah data)

## TC-KO-04 — Distribusi (terima kiriman)
- [ ] `/distribusi/terima` → daftar kiriman masuk outlet binaan tampil.
- [ ] `/distribusi/terima/scan` → scan surat jalan. ⚠️ (ubah data) verifikasi kiriman uji.

## TC-KO-05 — Absensi crew outlet
- [ ] `/dashboard/rekap` → rekap crew **outlet binaan saja**.
- [ ] `/dashboard/papan-kehadiran` → kehadiran crew outlet binaan.

## TC-KO-06 — POS Kasir (cover/pengawasan)
- [ ] `/kasir/menu` → bisa buka kasir.
- [ ] Tutup shift / lihat rekap kasir dapat diakses.

## TC-KO-07 — Batasan
- [ ] Owner Dashboard → ditolak.
- [ ] Admin Dashboard → ditolak.
- [ ] Data outlet lain (non-binaan) tidak terlihat di app manapun.

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Launcher kosong / tak ada app meski role benar | `staff_outlets` belum ada baris untuk user ini | Tambah pemetaan `staff_id↔outlet_id`; cek `accessible_outlet_ids()` |
| leader melihat **semua** outlet (harusnya subset) | RLS tak cek `staff_outlets` / helper `accessible_outlet_ids()` salah | Verifikasi RLS pakai keanggotaan `staff_outlets`, bukan `outlet_id` tunggal |
| Error PGRST200 saat buka staff/outlet terkait | FK `staff_outlets` drift | Lihat memory "Admin-Dashboard Deploy Chain" |
| Opname/permintaan gagal diam-diam (tak tersimpan) | Browser client kedua tanpa cookieOptions → write jadi anon (RPC `auth.uid()=null`) | Lihat memory "Two-Factory Browser Client Gotcha"; pakai `@suka/auth` client; cek RPC `_svc` (lihat CLAUDE.md Permintaan RLS) |
| Permintaan bahan ditolak RLS | `is_kitchen_staff`/`auth.uid()` check | Gunakan RPC `buat_permintaan_svc` (SECURITY DEFINER) — CLAUDE.md sesi 2026-06-17 |
| Terima kiriman tak update stok | Ledger tipe `terima_kiriman` tak tercatat | Cek insert ledger signed; RLS `ledger_read` |
| Bisa buka outlet non-binaan via URL | RLS scope bocor | **Bug serius** — catat & laporkan |

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
