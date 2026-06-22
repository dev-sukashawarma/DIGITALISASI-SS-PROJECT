# E2E Test — Role `owner`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **owner**.
> Jobdesk: Pemilik usaha — **owner-dashboard read-only**, tidak akses app operasional.

## Cakupan
owner hanya boleh **owner-dashboard** (read-only). Semua app lain ditolak.

---

## TC-OWN-01 — Login & launcher
| | |
|--|--|
| Langkah | Login portal |
| Diharapkan | Masuk launcher; **hanya** kartu **Owner Dashboard** |
- [ ] Tidak ada kartu pos-kasir / absensi / stok / distribusi / admin.

## TC-OWN-02 — Owner Dashboard terbuka
- [ ] `/dashboard` → omzet/penjualan agregat lintas outlet tampil.
- [ ] `/dashboard/profit` → laporan laba tampil.
- [ ] `/dashboard/expenses` → laporan pengeluaran tampil.

## TC-OWN-03 — Read-only ditegakkan
- [ ] Tidak ada tombol tambah/edit/hapus data operasional.
- [ ] Jika ada elemen input, menyimpan **gagal/ditolak** (bukan owner wewenang).

## TC-OWN-04 — App lain ditolak
Buka URL langsung; tiap satu harus **redirect ke portal**:
- [ ] Admin Dashboard → ditolak
- [ ] POS Kasir → ditolak
- [ ] Absensi → ditolak
- [ ] Stok → ditolak
- [ ] Distribusi → ditolak

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| owner BISA buka stok/absensi (harusnya ditolak) | Diuji di `localhost` → owner-dashboard skip enforcement; atau guard app lain tak aktif | **Tes di subdomain deploy**; cek `enforceAppAccess` terpasang di app tsb |
| owner-dashboard malah balik ke portal terus | Cookie domain / `SUPABASE_JWT_SECRET` belum di-set di owner-dashboard | Set cookie `.sukashawarma.com` + JWT secret |
| Launcher menampilkan app selain Owner Dashboard | `ROLE_APP_ACCESS.owner` salah / role tersimpan bukan `owner` | Cek `packages/auth/src/access.ts` (`owner` = `['owner-dashboard']`) & `outlet_staff.role` |
| Angka omzet/laba kosong | RLS/agregat view atau data periode kosong | Cek view sumber owner-dashboard & rentang tanggal |
| owner bisa mengubah data | Komponen tak meng-enforce read-only di server | Catat sebagai bug (least-privilege bocor) |

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
