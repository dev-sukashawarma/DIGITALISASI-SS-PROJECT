# E2E Test — Role `crew`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **crew**
> (wajah sudah ter-enroll).
> Jobdesk: Kru produksi/operasional — akses **paling sempit**: hanya absensi.

## Cakupan
crew hanya akses **absensi** (clock in/out face recognition + data diri). Semua app
lain ditolak.

---

## TC-CRW-01 — Login & launcher
- [ ] Login portal → launcher **hanya** menampilkan: **Absensi**.
- [ ] Tidak ada kartu lain.

## TC-CRW-02 — Presensi (clock in/out)
- [ ] Buka absensi → diarahkan ke fungsi presensi diri (bukan dashboard admin/rekap).
- [ ] ⚠️ (ubah data) **Clock in** dengan verifikasi wajah → berhasil.
- [ ] ⚠️ (ubah data) **Clock out** → berhasil.

## TC-CRW-03 — Data diri
- [ ] `/dashboard/profil` → lihat profil sendiri.
- [ ] `/dashboard/kru-checklist` (bila ada) → checklist tugas crew. ⚠️ (ubah data) isi 1 item.

## TC-CRW-04 — Batasan (least privilege)
- [ ] Tidak bisa lihat rekap/absensi crew lain (`/dashboard/rekap` tertutup/kosong).
- [ ] POS Kasir → ditolak.
- [ ] Stok → ditolak.
- [ ] Distribusi → ditolak.
- [ ] Owner / Admin Dashboard → ditolak.
- [ ] Tidak bisa lihat data outlet lain.

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Launcher menampilkan app selain Absensi | `ROLE_APP_ACCESS.crew` ≠ `['absensi']` / role salah | Cek `packages/auth/src/access.ts` & `outlet_staff.role` |
| crew bisa buka rekap semua crew | RLS `ledger_read`/absensi tak batasi ke diri/outlet | **Bug** — laporkan; crew = scope tersempit |
| Clock-in tertolak terus | Wajah belum enroll / kualitas wajah / luar geofence-jam | Enroll ulang (`/dashboard/enroll`); cek `outlet-config` |
| Verifikasi wajah lambat/gagal load | face-api model belum termuat | Cek aset model di public/; jaringan |
| Tampilan jam/tanggal beda saat reload | Hydration mismatch (`Date.now()` saat render) | Catat; bukan masalah akses (lihat pola fix CrewDashboard di CLAUDE.md) |
| crew login tapi balik ke portal | `status ≠ active` atau cookie domain | Cek `outlet_staff.status='active'`; tes di subdomain |
| Nama crew salah / "Aris S." statis | Header pakai nilai hardcode lama | Sudah difix (pakai `outletStaff.name`); jika muncul, regresi |

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
