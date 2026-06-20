# E2E Test — Role `kiosk`

> Prasyarat bersama: lihat [README.md](README.md). Akun: baris **kiosk**
> (device, login via QR — bukan email/password portal).
> Jobdesk: **Perangkat**, bukan manusia. Tablet mode kiosk POS/antrian, terikat outlet.

## Cakupan
kiosk **tidak** masuk portal SSO manusia. Login lewat **QR device-bound** di
pos-kasir, hanya mode kiosk, terikat 1 outlet.

---

## TC-KSK-01 — Negatif: ditolak di portal SSO
| | |
|--|--|
| Langkah | Coba login kredensial kiosk di **Portal** |
| Diharapkan | **Ditolak** — tidak masuk launcher (kiosk di-exclude dari guard manusia) |
- [ ] Pass

## TC-KSK-02 — QR device login
- [ ] Generate QR kiosk dari akun admin/kasir (`/api/kasir/generate-kiosk-qr`).
- [ ] Buka `/kiosk/qr-login` di device → scan QR → masuk **mode kiosk**.
- [ ] Sesi panjang/persisten (tidak minta login ulang tiap aksi).

## TC-KSK-03 — Mode kiosk terbatas
- [ ] Tampilan **mode kiosk** (pesan/antrian), BUKAN POS kasir penuh.
- [ ] Menu/produk sesuai **outlet device** (bukan outlet lain).
- [ ] Tidak ada akses admin/setting/histori penuh.

## TC-KSK-04 — Isolasi & logout
- [ ] Dari kiosk tidak bisa buka absensi/stok/distribusi/owner/admin.
- [ ] ⚠️ (ubah data) Buat order kiosk uji → masuk antrian outlet yang benar.
- [ ] Kiosk logout (`/api/kiosk/logout`) → sesi device berakhir.

---

## Kemungkinan masalah & troubleshooting

| Gejala | Penyebab mungkin | Tindakan |
|--------|------------------|----------|
| Kredensial kiosk BISA login di portal | kiosk tak di-exclude dari guard manusia | **Bug keamanan** — laporkan; kiosk harus terpisah total dari SSO |
| QR tak bisa di-scan / login gagal | QR kedaluwarsa / token device tak cocok | Generate ulang QR; cek `migration-kiosk-logout.sql` & device binding |
| Mode kiosk menampilkan POS penuh | Routing kiosk salah / role device tak ter-set kiosk | Cek alur `/kiosk` vs `/kasir`; `outlet_staff.role='kiosk'` |
| Produk outlet lain muncul di kiosk | `outlet_id` device salah / isolasi outlet bocor | Cek binding device→outlet; `migration-outlet-isolation.sql` |
| Order kiosk masuk outlet lain | Sesi tak terikat outlet device | Periksa `outlet_id` pada sesi kiosk |
| Logout kiosk tak mengakhiri sesi | Endpoint logout tak hapus sesi device | Cek `/api/kiosk/logout` |
| Setelah logout, device tetap bisa order | Sesi persisten tak dibersihkan | **Bug** — laporkan |

> Catatan: alur kiosk **device-bound** dan sebagian butuh perangkat fisik/kamera.
> Jika tak bisa diuji penuh, minimal jalankan **TC-KSK-01** (negatif portal) yang
> wajib lulus.

## Hasil
| Tester | Tanggal | Status (✅/❌/⚠️) | Catatan |
|--------|---------|------|---------|
| | | | |
