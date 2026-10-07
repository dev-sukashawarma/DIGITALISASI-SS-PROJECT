# Gerbang domain `absensi` (bot HRD)

Spec: `docs/superpowers/specs/2026-10-07-bot-hrd-dashboard-design.md` §6.

## Uji jalan di data produksi (2026-10-07 ±14:22 WIB)

Alat dipanggil langsung (loader `buatKonteksAbsensi` + service role), belum lewat endpoint MCP.

| Alat | Argumen | Waktu | Hasil |
|---|---|---|---|
| absensi_hari_ini | – | 386 ms | 23 lokasi, 220 staf: hadir 60, telat 4, toleransi 4, belum 0, alpa 152 |
| absensi_hari_ini | 2026-10-06 | 85 ms | hadir 16, telat 2, toleransi 3, alpa 152 |
| absensi_rekap | 2026-10-01..06 | 56 ms | 6 hari dinilai; mis. KANTOR PUSAT 28 staf, telat 8, toleransi 7, alpa 44 |
| absensi_telat_bulan_ini | – | 55 ms | 214 orang telat/alpa |
| cuti_izin | – | 58 ms | 0 sedang cuti, 6 menunggu |
| kasbon_ringkasan | – | 105 ms | menunggu 1 (Rp300.000), aktif 7 (sisa Rp2.250.000), 8 outlet |
| ceklist_kepatuhan | 2026-10-06 | 51 ms | 20 lokasi, 3 sudah dicek, 17 belum, 3 perlu perhatian |

RPC: `hermes_absensi_rekap_staf` + `hermes_kasbon_per_outlet` sebulan = 2,8 ms. T2 lulus, kontrol negatif terpicu.

Catatan rumus (sesuai D7, bukan bug alat):
- Ringkasan papan tidak menghitung status `lebih_awal`/`pulang_telat` di kolom mana pun (hadir+telat+toleransi+alpa < staf).
- Alpa tinggi (152/220) = staf aktif tanpa absen; cuti/libur & staf yang tak memakai absensi belum dikecualikan.

## Gerbang 1 — cocok angka dengan layar
- [ ] Papan Kehadiran (app absensi) 2 outlet + Kantor Pusat, hari ini — setelah absensi di-redeploy (batas alpha WIB).
- [ ] Rekap absensi 7 hari, 2 outlet: telat & alpa.
- [ ] HR Perizinan: cuti disetujui hari ini & menunggu; kasbon pending.
- [ ] HR Ceklist Harian: "n / N outlet sudah dicek".

## Gerbang 2 — kunci
- [ ] Kunci scope `penjualan` → alat absensi "Alat tidak dikenal".
- [ ] Kunci scope `absensi` → `penjualan_ringkasan` "Alat tidak dikenal".
- [ ] Kunci dicabut → 401.

## Gerbang 3 — larangan data
- [x] `registry.test.ts` GERBANG §6 (11 alat) + kasbon tanpa nama/id staf — lulus.
- [x] Grep output nyata 6 alat untuk pola terlarang — 0 kecocokan (2026-10-07).

## Gerbang 4 — masa uji 1 minggu (dev/owner)
- [ ] Mulai: …
