# 03 — Status yang Lahir dari Ketiadaan Data (Alfa, dsb.)

Contoh: **alfa** = hari kerja tanpa absen & tanpa izin. Tidak ada event "tidak datang",
jadi status ini harus **dihitung**, bukan dicatat oleh pengguna.

## Jangan

- Menghitung on-the-fly `staf × hari` di setiap request (biaya ikut membengkak).
- Menyisipkan data **palsu** ke tabel mentah (cron lama `mark-alpha` memasukkan clock-in
  palsu jam 23:59 — mencemari data sumber, dan gagal total tiap hari karena satu baris NULL).
- Menandai alfa tanpa aturan hari kerja → ±50 alfa palsu per hari.

## Pola

1. **Materialisasi ke tabel rekap yang sama** dengan kolom `sumber` (`absen` | `cuti` | `alfa`)
   dan `keterangan`. Halaman & laporan tidak perlu tahu cara hitungnya.
2. **Satu fungsi idempoten** `hitung_status(tanggal, staff?)`: hapus baris non-absen untuk
   kunci itu lalu tulis ulang dari aturan. `staff` NULL = semua.
3. **Dipicu oleh setiap sumber yang memengaruhi hasil** (trigger):
   - data absen masuk/dihapus → alfa gugur / muncul lagi
   - pengajuan cuti disetujui/dibatalkan → alfa ↔ cuti
   - tanggal merah ditambah/dinonaktifkan → alfa dihapus/dihitung ulang
   - data karyawan berubah (resign, pindah outlet) → hitung ulang periode pelacakan
4. **Cron harian** menutup hari kemarin + **lookback 7 hari** (menangkap koreksi terlambat).
   ⚠️ `pg_cron` memakai **UTC**: `'10 17 * * *'` = 00:10 WIB.
5. **Anti positif-palsu** (yang membuat sistem "pintar"):
   - hanya entitas sungguhan (bukan akun tes/kiosk/mitra)
   - hanya sejak bergabung, sejak **pertama kali memakai sistem**, tidak setelah resign
   - hanya hari yang **sudah lewat** (hari ini belum selesai)
   - tanggal mulai pelacakan bisa diatur (`global_settings`)
   - hari libur dari **tabel** (bukan hardcode) yang bisa dikoreksi HR
   - hari libur **per kelompok peran**: di HR, Minggu & tanggal merah hanya libur untuk role
     kantor (`global_settings.hr.role_libur_kantor`); outlet F&B tetap hari kerja. Data absensi
     membuktikan outlet buka normal di Minggu/tanggal merah (40–49 orang absen)
6. **Ukur dulu sebelum menerapkan**: bedah siapa saja yang kena (per role, per jumlah hari
   masuk, sebelum/sesudah tanggal mulai pakai). Di HR, 408 dari 1.044 alfa ternyata palsu.

## Data eksternal (tanggal merah)

- Sumber: kalender resmi Google "Hari Libur di Indonesia" (ICS publik, tanpa API key):
  `https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics`
  Ambil hanya `DESCRIPTION: Hari libur nasional` (bukan "Perayaan").
- API komunitas (`api-harilibur`, `dayoffapi`) **sudah mati** per 2026-09 — jangan dipakai.
- Simpan di tabel lokal (`hari_libur`) + seed di migration → sistem tidak bergantung pada
  jaringan saat menghitung. Sinkron via server action (tombol + otomatis tiap 30 hari).
- Tandai `diubah_manual` supaya sinkron tidak menimpa keputusan HR.

Template: [`templates/status_otomatis.sql`](templates/status_otomatis.sql)
Referensi nyata: `supabase/migrations/20260929150000_hr_status_kehadiran_lengkap.sql`,
`apps/HR/src/lib/hariLibur.ts`, `apps/HR/src/app/actions/hariLibur.ts`.
