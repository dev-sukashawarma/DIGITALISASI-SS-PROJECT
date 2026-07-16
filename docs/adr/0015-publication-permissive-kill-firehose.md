# 15. Publication realtime permisif + bunuh firehose client

Tanggal: 2026-07-16
Status: Diterima

## Konteks
`GlobalRealtimeProvider` (pos-kasir, admin-dashboard, finance) men-subscribe
seluruh schema `public` (`event:'*'`) lalu invalidate queryKey `[table]`. Pola ini
(a) boros — tiap perubahan tiap tabel mem-fan-out ke tiap browser; (b) tak
reliabel — hanya bekerja bila queryKey kebetulan sama dengan nama tabel (mis.
`['staff']` vs tabel `outlet_staff` → mati diam-diam). Migration
`20260713100000_enable_realtime_all` memasukkan semua tabel ke publication.

## Keputusan
1. Bunuh firehose client di semua app; ganti dengan subscription scoped eksplisit
   (`@suka/realtime`) per query yang butuh update lintas-sesi.
2. BIARKAN publication permisif (`enable_realtime_all` tetap). Tidak memangkas jadi
   allowlist.

## Alasan tidak memangkas publication
- Biaya nyata yang dirasakan (fan-out event mubazir) berasal dari SUBSCRIPTION
  wildcard, bukan publication membership. Membunuh firehose sudah menghapusnya.
- DB ini shared dengan dev lain yang aktif push migration (drift rutin). Memangkas
  publication berisiko mematikan konsumen realtime di app tak-teraudit / kerja dev
  lain secara senyap — persis penyakit "mati diam-diam" yang diberantas.

## Konsekuensi
- Biaya decode WAL server-side (semua tabel) diterima sebagai trade-off keamanan.
- Bila kelak jadi beban nyata (metrik Supabase Realtime), pemangkasan publication =
  proyek terpisah dengan audit repo-penuh lebih dulu.
- `REPLICA IDENTITY FULL` ditambah selektif & aditif untuk tabel ber-filter/DELETE.
