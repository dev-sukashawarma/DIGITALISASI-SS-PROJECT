# Handoff — Aplikasi Native: Petty Cash Langsung ke Finance (tanpa AM)

**Tanggal:** 25 Nov 2026 · **Untuk:** pemegang repo aplikasi native
(`rendydev404/SUPER-APPS-SS-MOBILE` = superapp leader/manager, dan repo POS kasir tablet)
**Status sisi server:** ✅ LIVE sejak 25 Nov 2026 (migration `20261125120000_petty_cash_tanpa_am`,
web sudah di-deploy). Aplikasi native **belum** ikut berubah.

> ⚠️ **Mendesak:** sejak alur ini live, leader yang memakai aplikasi HP **tidak punya tombol
> konfirmasi dana**. Modul leader masih menunggu status `forwarded_by_area_manager`, yang kini
> tak pernah terjadi lagi. Sampai APK baru dirilis, leader harus mengonfirmasi lewat web:
> admin-dashboard → **Petty Cash** (leader) atau app finance → Leader → Petty Cash.

Spec & catatan lengkap ada di repo web: `docs/superpowers/specs/2026-11-25-petty-cash-tanpa-am-design.md`
dan `CLAUDE.md` (Session 2026-11-25). Acuan perilaku web: `apps/admin-dashboard/src/lib/pettyCash/tahap.ts`.

---

## 1. Apa yang berubah (kontrak server)

### Alur baru
| # | Siapa | RPC | Status jadi | Efek |
|---|---|---|---|---|
| 1 | Leader (atau peran di atasnya) | `create_petty_cash_topup` | `forwarded_to_finance` | Masuk Hub Approval Finance |
| 2 | Finance | `finance_process_petty_cash_custom` (web) | `approved_by_finance` / `rejected` | Uang ditransfer + bukti wajib |
| 3 | Leader outlet itu | `leader_forward_funds(p_topup_id)` | `forwarded_by_leader` | **Saldo kas kecil POS bertambah** |

AM **tidak** lagi menyetujui maupun menyerahkan dana.

### Perubahan perilaku yang harus diketahui aplikasi
- **`create_petty_cash_topup`**: status awal kini `forwarded_to_finance` (dulu `forwarded_to_area_manager`).
  Outlet harus ada di `accessible_outlet_ids()` pemanggil. Kalau tidak, muncul galat
  `"Tidak berwenang mengajukan petty cash untuk outlet ini"`.
- **`leader_forward_funds`** sekarang:
  - hanya menerima status **`approved_by_finance`**. Status lain memberi galat
    `"Dana belum ditransfer Finance atau sudah dikonfirmasi (status: …)"`;
  - hanya untuk peran `leader`, `admin`, `owner` yang aktif, dan outlet harus ada di cakupannya
    (galat: `"Tidak berwenang …"`);
  - menolak bila pemanggil adalah orang yang mencairkan dana.
- **RPC tahap AM dimatikan.** `area_manager_process_petty_cash`, `area_manager_forward_funds`,
  `finance_forward_funds`, `korlap_process_petty_cash`, `korlap_forward_funds`, dan
  `review_petty_cash_topup` sekarang selalu gagal dengan pesan
  `"Tahap Area Manager sudah dihapus sejak 25 Nov 2026. Pengajuan petty cash kini langsung ke Finance."`
- **Saldo POS** (`get_petty_cash_snapshot`) tidak lagi menghitung `approved_by_finance`. Dana baru
  masuk saldo saat status `forwarded_by_leader` (juga `approved`/`completed` untuk data lama).
- **Penolakan** hanya mungkin dari `forwarded_to_finance`. Setelah dana dicairkan, pengajuan tidak bisa ditolak.
- **Push notifikasi:**
  - tidak ada lagi push petty cash top up ke AM (`app: manager`, `url: manager_petty_cash`);
  - push baru dikirim ke **pengaju** saat Finance mentransfer: `app: leader`, `type: petty_cash_urgent`,
    `url: leader_petty_cash`, judul `"💰 Petty Cash Sudah Ditransfer"`;
  - push pengeluaran kasir (`manager_petty_cash_pengeluaran`) **tidak berubah**.
- **Tidak berubah:** alur pengeluaran kasir (`petty_cash_expenses`, disetujui AM lewat
  `review_petty_cash_expense`) tetap seperti sebelumnya.

### Peta status → label (samakan dengan web)
| Status | Label | Aksi leader | Dihitung saldo POS |
|---|---|---|---|
| `forwarded_to_finance` | Menunggu Finance | – | tidak |
| `approved_by_finance` | Sudah ditransfer, menunggu konfirmasi leader | **Dana diterima & masuk laci** | tidak |
| `forwarded_by_leader` | Dana diterima (saldo bertambah) | – | **ya** |
| `completed` | Selesai | – | ya |
| `rejected` | Ditolak | – | tidak |
| `forwarded_to_area_manager` | Menunggu Area Manager (alur lama) | – | tidak |
| `forwarded_by_finance` | Diserahkan ke Area Manager (alur lama) | – | tidak |
| `forwarded_by_area_manager` | Diserahkan ke leader (alur lama) | – | tidak |

Baris berstatus alur lama hanya tersisa sebagai riwayat. Per 25 Nov ada 3 baris uji di outlet tes, dan baris-baris ini tidak bisa berpindah status lagi.

---

## 2. Superapp (`SUPER-APPS-SS-MOBILE`) — yang harus diubah

Nomor baris mengacu ke salinan lokal versi **1.7.39**. Origin sudah di 1.7.41, jadi cek ulang lokasinya.

### Modul Leader (wajib, ini yang memblokir leader)
1. `feature/leader/.../domain/Pengajuan.kt`
   - `STATUS_BUTUH_AKSI` → `setOf(StatusPengajuan.DISETUJUI_FINANCE)` (`approved_by_finance`).
     Saat ini isinya `SIAP_DISERAHKAN`, yang tidak akan pernah muncul lagi.
   - Label disamakan dengan tabel di atas. `DISETUJUI_FINANCE` → "Sudah ditransfer, menunggu
     konfirmasi leader"; `DISERAHKAN_KE_CREW` → "Dana diterima (saldo bertambah)";
     `DIAJUKAN`/`DITERUSKAN_KE_AM`/`DITERUSKAN_FINANCE`/`SIAP_DISERAHKAN` → label "(alur lama)".
   - `STATUS_MENUNGGU_AM` sudah tidak relevan. Ganti dengan "menunggu Finance" = `DI_FINANCE`.
   - Perbarui KDoc (`create_petty_cash_topup` kini melahirkan `forwarded_to_finance`).
2. `feature/leader/.../ui/LencanaViewModel.kt`: filter badge `eq.${SIAP_DISERAHKAN.nilai}` →
   `eq.approved_by_finance`.
3. `feature/leader/.../ui/pettycash/PettyCashScreen.kt` (sekitar baris 432–440): tombol
   "Terima & Serahkan ke Crew" → **"Dana diterima & masuk laci"**. Dialog konfirmasi berisi
   "Uang sudah masuk laci kasir? Saldo petty cash outlet akan bertambah." Tombol hanya tampil untuk
   `STATUS_BUTUH_AKSI`.
4. `feature/leader/.../data/PengajuanRepository.kt`: perbarui komentar status awal (baris ~84).
   Tampilkan pesan galat server apa adanya, karena isinya sudah berbahasa Indonesia.
5. `feature/home/.../ui/HomeViewModel.kt` (baris ~455): leader `"eq.forwarded_by_area_manager"` →
   `"eq.approved_by_finance"`.
6. Tes: `feature/leader/src/test/.../PengajuanTest.kt` (tombol hanya untuk `approved_by_finance`,
   label baru).

### Modul Manager (AM jadi pantauan saja)
7. `feature/manager/.../domain/PettyCash.kt`: `STATUS_BUTUH_REVIEW`, `STATUS_MENUNGGU_ACC`, dan
   `STATUS_SIAP_DISERAHKAN` tidak lagi punya aksi. `aksiUntuk()` → selalu "tanpa aksi". Daftar
   "sedang berjalan" = `forwarded_to_finance` + `approved_by_finance`. Label disamakan dengan tabel.
8. `feature/manager/.../ui/pettycash/PettyCashScreen.kt` + `data/PettyCashRepository.kt`
   (baris ~88 dan ~172): **buang** tombol ACC/Tolak/Serahkan beserta panggilan
   `area_manager_process_petty_cash` dan `area_manager_forward_funds`, karena RPC itu sekarang selalu gagal.
   Halaman tetap tampil sebagai riwayat/pantauan. **Jangan** sentuh panel pengeluaran kasir.
9. `feature/home/.../ui/HomeViewModel.kt` (baris ~457–459): badge manager untuk petty cash top up
   → `null` (tidak ada antrean AM lagi).
10. `feature/manager/.../data/SidakRepository.kt` (komentar baris ~214): sesuaikan.
11. Tes: `feature/manager/src/test/.../PettyCashTest.kt`.

### Notifikasi
12. `app/.../notif/NotifikasiTujuan.kt` dan `SuperappMessagingService.kt`: rute `leader_petty_cash`
    sudah ada, jadi pastikan push "Sudah Ditransfer" membuka layar Petty Cash leader. Rute
    `manager_petty_cash` untuk top up tidak akan menerima push lagi, sedangkan push pengeluaran
    kasir tetap.
13. `PettyCashAlarmManager` / `PettyCashActionReceiver`: kalau alarm "segera serahkan" dipicu
    status AM, pindahkan pemicunya ke `approved_by_finance` untuk leader, atau matikan untuk AM.

### Rilis
14. Naikkan versi, rilis APK, lalu naikkan "Versi minimum" bila ingin memaksa leader memperbarui aplikasi.

---

## 3. POS kasir tablet (repo terpisah) — yang perlu dicek

Kode POS kasir native tidak ada di mesin tempat handoff ini dibuat, jadi bagian ini berupa daftar
periksa. Acuannya perubahan di POS web (`apps/pos-kasir`, commit `5d4eb7d08`):
- **Saldo kas kecil:** kalau aplikasi memakai `get_petty_cash_snapshot`, **tidak perlu perubahan**
  karena perbaikannya di server. Kalau aplikasi menghitung sendiri dari `petty_cash_topups` (seperti
  web dulu, `SUDAH_DI_LACI` di `shift/close/page.tsx` dan `ShiftBlockerMount.tsx`), **buang
  `approved_by_finance`** dari daftar status. Daftar yang benar: `forwarded_by_leader`, `approved`,
  `completed`. Tanpa ini, saldo hasil hitung aplikasi berbeda dari server, dan tutup shift mencatat
  selisih atas nama kasir.
- **Label status top up** di riwayat shift: samakan dengan tabel di §1. Web: `forwarded_to_finance`
  = "Menunggu Finance", `approved_by_finance` = "Sudah ditransfer, menunggu konfirmasi leader".
- Kalau ada tombol/alur petty cash top up yang memanggil RPC AM, buang.

---

## 4. Cara uji (setelah build)
1. Login sebagai leader → ajukan top up → status **Menunggu Finance**, AM tidak menerima notifikasi.
2. Finance mencairkan di web (bukti wajib) → leader menerima push "Sudah Ditransfer" → tombol
   **Dana diterima & masuk laci** muncul → tekan → status **Dana diterima**, saldo POS outlet
   naik sebesar nominal.
3. Sebelum langkah 2 dikonfirmasi, saldo POS **belum** naik.
4. Login sebagai AM → halaman petty cash hanya berisi daftar, tanpa tombol aksi, dan tidak ada galat.
5. Login sebagai leader outlet lain → tidak melihat atau tidak bisa mengonfirmasi pengajuan outlet itu.
6. Uji dengan outlet tes, lalu periksa tidak ada sisa data uji.
