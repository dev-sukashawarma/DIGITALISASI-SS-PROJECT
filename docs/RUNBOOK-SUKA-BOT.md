# Runbook SUKA Bot

Spec: `docs/superpowers/specs/2026-10-03-suka-bot-design.md` ·
Plan: `docs/superpowers/plans/2026-10-03-suka-bot-tahap1.md`

## Status database (sudah, 2026-10-05)
Migration `20261003180000_suka_bot.sql` dijalankan owner lewat SQL Editor, lalu
diverifikasi ke katalog: 5 tabel (RLS aktif), 8 policy, 2 fungsi SECURITY DEFINER,
cron `suka-bot-retensi-90-hari` (`30 20 * * *` = 03:30 WIB), anon tanpa akses.
Uji `supabase/verifikasi/suka_bot/t1_rls.sql` LULUS + kontrol negatif gagal sesuai
harapan. Riwayat migration terstempel.

## Prasyarat (sekali)
1. 9Router: buat/arahkan satu model untuk SUKA Bot di atas **API key berbayar**. Matikan
   fallback ke model lain dan fitur penghemat token (RTK) untuk model ini.
2. Pastikan container admin-dashboard bisa menjangkau 9Router:
   dari terminal container Coolify admin-dashboard jalankan
   `node -e "fetch(process.env.AI_BASE_URL + '/models', {headers:{Authorization:'Bearer '+process.env.AI_API_KEY}}).then(r=>console.log(r.status))"`
   → harus `200`. Endpoint 9Router tidak boleh terbuka ke internet tanpa API key.
3. Panel Coolify app admin-dashboard → tambahkan env: `AI_BASE_URL` (mis. `http://<host-9router>:20128/v1`),
   `AI_API_KEY`, `AI_MODEL`, `SUKA_BOT_ALLOWED_ORIGINS` (`https://app.sukashawarma.com`),
   `SUKA_BOT_BATAS_HARIAN` (`100`). Dockerfile sudah meneruskannya ke stage runner.
4. Batas kredit bulanan di akun penyedia API.

## Uji lokal sebelum deploy (belum dijalankan)
1. Isi `apps/admin-dashboard/.env.local`: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`
   (isi sendiri, jangan ditempel di chat/terminal).
2. Jalankan admin-dashboard (`yarn dev`, port 3005) dan portal (port 3010), login sebagai admin.
3. Launcher: avatar "SB" kanan bawah + titik merah → klik → rekap tampil "Dibuat HH:MM WIB".
4. Tanya "ranking outlet kemarin", "omzet GoFood Beji minggu ini", "stok sapi di Empang".
5. Tanya "laba kemarin berapa?" → jujur belum bisa; muncul di `suka_bot_gagal`.
6. Matikan admin-dashboard → launcher tetap normal, panel bilang "tidak tersedia".
7. Login crew → avatar tidak muncul; `/asisten` di-redirect ke `/launcher`.
8. Lebar 375px: panel tidak melebihi layar.

## Pencocokan angka (wajib sebelum rilis — spec §11)
Untuk **kemarin**, **minggu ini**, **bulan lalu**: jawaban "omzet <rentang>" harus sama
sampai rupiah dengan `/dashboard/reports/pos` rentang sama, **ke-21 outlet bertipe
outlet/mitra dipilih** (bukan "Semua Cabang" — itu ikut SS Online), kartu **Gross
Revenue**. Ulangi untuk satu outlet (Beji) dan satu kanal (GoFood). Ranking kemarin:
3 outlet teratas = Rangkuman Penjualan dengan filter outlet itu saja.
Stok: 5 bahan × 3 outlet (termasuk satu baris `saldo_is_gram = true`) = app Stok › Monitoring.
**Bila ada selisih: berhenti, jangan rilis.**

| Rentang | Cakupan | SUKA Bot | Rangkuman Penjualan | Cocok? |
|---|---|---|---|---|

## Deploy
1. Redeploy **admin-dashboard** dulu, lalu **portal**.
2. Smoke test: login admin di portal → avatar → rekap muncul → tanya "omzet kemarin".
3. Login crew → avatar tidak muncul.

## Pemantauan
- Pertanyaan gagal (developer): `select pertanyaan, alasan, dibuat_at from suka_bot_gagal order by dibuat_at desc limit 50;`
- Pemakaian: `select tanggal, sum(jumlah_pertanyaan), sum(token_masuk), sum(token_keluar) from suka_bot_pemakaian group by 1 order by 1 desc;`
- Rekap: `select tanggal, versi, dibuat_at from suka_bot_rekap order by tanggal desc, versi desc limit 10;`

## Gejala → sebab
- Panel "tidak tersedia" terus: env AI_* kosong di stage runner / 9Router tak terjangkau / admin-dashboard down.
- 401 padahal admin: cookie SSO tidak terkirim — cek `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di kedua app.
- Panel kosong tanpa galat di konsol: cek CORS — origin portal harus ada di `SUKA_BOT_ALLOWED_ORIGINS`.
- Owner dapat 302/redirect ke portal dari `/api/asisten/*`: middleware admin-dashboard tidak melewati
  `/api/asisten/` (cek `src/middleware.ts`).
