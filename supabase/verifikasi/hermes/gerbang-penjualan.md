# Gerbang domain penjualan (spec 2026-10-07 §9)

Domain penjualan baru boleh dipakai bos setelah keempat gerbang terisi **lulus**.

| # | Gerbang | Cara | Hasil | Tanggal / oleh |
|---|---|---|---|---|
| 1 | Cocok angka | 3 tanggal lampau berbeda (mis. Senin, Sabtu, tanggal 1). Panggil `penjualan_ringkasan {periode:"rentang",dari:T,sampai:T}` dan `penjualan_peringkat_outlet` yang sama. Bandingkan dengan /dashboard/reports/pos tanggal T, outlet = semua outlet internal + mitra aktif (BUKAN "Semua Cabang", yang ikut SS Online). Omzet kotor, transaksi, dan omzet 3 outlet acak harus SAMA PERSIS. | Lokal 6 Okt 2026: Rp 66.105.510 / 1.156 trx / 20 outlet = identik `suka_bot_rekap` 6 Okt (dihitung lewat sesi admin). Pembanding layar belum. | 2026-10-07 / Claude (lokal) |
| 2 | Uji kunci | Di produksi: tanpa kunci → 401 (bukan redirect 307); kunci salah → 401; IP lain → 403; **kirim header `x-real-ip` palsu dari luar → tetap 403** (bukti Traefik/Coolify menimpa header — kalau lolos, allowlist IP bisa dipalsukan); cabut → 401; kunci scope `gudang` tidak melihat alat penjualan di `tools/list`. | Lokal lulus: tanpa kunci 401, palsu 401, IP lain 403, dicabut 401, luar scope ditolak, GET 405, notifikasi 202. Produksi 2026-10-07: tanpa kunci 401 (bukan redirect), GET 405; `x-real-ip`/`x-forwarded-for` palsu **tidak** lolos — tetapi IP tercatat = **edge Cloudflare** (172.70.92.232, 104.23.175.17), bukan IP pemanggil. Diperbaiki (`fix/hermes-cloudflare-ip`): baca `cf-connecting-ip` hanya bila pengirim ∈ rentang Cloudflare. Setelah redeploy: ulangi — log harus menampilkan IP asli; kirim `cf-connecting-ip` palsu → tetap tercatat IP asli. | 2026-10-07 / Claude |
| 3 | Larangan data | `yarn test src/lib/hermes/registry.test.ts` (GERBANG §6) lulus. Kontrol negatif: sisipkan field `gaji_*` ke output alat → test gagal. | Lulus + kontrol negatif tertangkap. | 2026-10-07 / Claude |
| 4 | Masa uji 1 minggu | Laporan pagi 07:00 dikirim ke grup Telegram uji (hanya dev) 7 hari berturut-turut; tiap hari dicocokkan dengan layar. Baru dipindah ke grup Owner. | | |

Catatan: kunci uji lokal `667ce866` ("UJI LOKAL — hapus setelah tes") sudah **dicabut**; barisnya
masih ada di `hermes_api_key` (penghapusan ditunda, menunggu keputusan dev).
