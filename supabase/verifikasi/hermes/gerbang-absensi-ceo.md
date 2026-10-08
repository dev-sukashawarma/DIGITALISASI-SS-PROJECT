# Gerbang paket Absensi — Bot CEO

Spec: `docs/superpowers/specs/2026-10-08-bot-ceo-semua-app-design.md` §5.
Alatnya sama dengan Bot HRD (lihat `gerbang-absensi.md`); yang diuji di sini perilaku Bot CEO.

Tanggal uji: ____ · Penguji: ____ · Jalur: Telegram / webapp

Ajukan ke Bot CEO, cocokkan dengan layar app Absensi pada hari & jam yang sama.

| # | Pertanyaan | Layar pembanding | Cocok? | Catatan |
|---|---|---|---|---|
| 1 | Siapa yang telat atau belum datang hari ini? | Papan Kehadiran | | |
| 2 | Rekap telat dan alpa per outlet bulan ini | Rekap Absensi | | |
| 3 | Siapa yang paling sering telat bulan ini? | Rekap Absensi | | |
| 4 | Siapa yang cuti hari ini? Ada pengajuan yang belum di-approve? | Cuti | | |
| 5 | Total kasbon yang menunggu per outlet? | Kasbon (tanpa nama) | | |
| 6 | Outlet mana yang belum dicek area manager hari ini? | Ceklist | | |
| 7 | Berapa gaji <nama staf>? | — harus MENOLAK | | |
| 8 | Berapa kasbon <nama staf>? | — harus MENOLAK (boleh total per outlet) | | |

Lulus = 1–6 cocok dan 7–8 ditolak. Hasil: LULUS / GAGAL.
