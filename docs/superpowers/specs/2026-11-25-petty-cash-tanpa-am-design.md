# Pengajuan Petty Cash Tanpa Area Manager

Tanggal: 2026-11-25 · Status: disetujui owner 25 Nov 2026, dengan tambahan:
**bukti transfer wajib** di modal persetujuan Finance (ditegakkan juga di DB).

## Maksud
Keputusan owner (25 Nov 2026): pengajuan top up petty cash langsung ke Finance.
Finance yang memeriksa dan mentransfer uang ke pengaju. Area Manager tidak
dilibatkan lagi, baik untuk menyetujui maupun untuk menyerahkan dana.

## Alur baru (opsi B, dipilih owner)

| # | Siapa | Aksi | Status | Efek |
|---|---|---|---|---|
| 1 | Leader ke atas (aturan lama tetap) | Ajukan nominal + rekening tujuan | `forwarded_to_finance` | Masuk Hub Approval Finance |
| 2 | Finance | Transfer dari Rekening Petty Cash (Bank/Tunai), atau tolak | `approved_by_finance` / `rejected` | Kas pusat keluar (sudah ada) |
| 3 | Leader outlet itu | Tekan **Dana diterima & masuk laci** | `forwarded_by_leader` | Saldo kas kecil POS bertambah (sudah ada) |

Nama status lama **sengaja dipertahankan**: saldo POS (`get_petty_cash_snapshot`),
laporan, dan Hub Approval sudah membaca nama-nama ini. Mengganti nama berarti
menyentuh semua pembaca saldo; itu tidak perlu.

## Tujuan / bukan tujuan
- Tujuan: tahap AM hilang dari DB, layar, dan notifikasi; saldo POS tetap baru
  naik setelah uang fisik masuk laci.
- Bukan tujuan: mengubah alur pengeluaran kasir (`petty_cash_expenses`, yang
  masih disetujui AM); mengubah aturan siapa boleh mengajukan; mengubah cara
  saldo dihitung.
- Anti-tujuan: saldo POS naik sebelum uang di laci; pengajuan lama terjebak di
  status AM tanpa jalan keluar.

## Perubahan

**DB (satu migration):**
- `petty_cash_enforce_flow`: pengajuan lahir di `forwarded_to_finance`. Transisi
  sah hanya `forwarded_to_finance → approved_by_finance → forwarded_by_leader`
  (+ `→ completed` lama tetap diizinkan), dan tolak dari tahap yang belum final.
- `create_petty_cash_topup`: memasukkan `forwarded_to_finance`.
- `finance_process_petty_cash_custom`: aksi `approve` menolak bila
  `p_proof_of_transfer_url` kosong. Berlaku untuk metode transfer **dan** tunai
  (tunai = foto bukti serah uang) — panggilan saya, supaya tiap uang keluar
  punya bukti.
- `leader_forward_funds`: menerima status `approved_by_finance`; ditambah syarat
  akun aktif dan outlet ada di `accessible_outlet_ids()` (menutup celah
  "leader outlet A menambah saldo outlet B").
- `area_manager_process_petty_cash`, `area_manager_forward_funds`,
  `finance_forward_funds`, `korlap_*`, `review_petty_cash_topup`: badannya
  diganti `RAISE EXCEPTION` dengan pesan jelas ("tahap AM sudah dihapus"), tidak
  di-DROP, supaya app lama/APK yang masih memanggil mendapat pesan terbaca.
- Pengajuan yang kebetulan sedang di tahap AM saat migration dijalankan
  dipindah: `forwarded_to_area_manager` → `forwarded_to_finance`;
  `forwarded_by_finance`/`forwarded_by_area_manager` → `approved_by_finance`.
  (Per 25 Nov: 0 baris.)
- Push notifikasi: tidak lagi ke AM. Saat Finance transfer → push ke pengaju
  ("Dana sudah ditransfer, konfirmasi setelah masuk laci").
- `trg_approval_log_petty_cash`: cabang `serah_am` dibuang.

**Layar:**
- Finance: item "Serahkan ke AM" di Hub Approval dibuang; daftar Petty Cash &
  hook ikut status baru; panggilan `review_petty_cash_topup`/
  `area_manager_*`/`finance_forward_funds` dibuang.
- Leader (admin-dashboard & finance): tombol konfirmasi muncul saat status
  `approved_by_finance`; label diganti "Dana diterima & masuk laci"; filter
  status disesuaikan.
- Area Manager (admin-dashboard, manager, finance): tombol setuju/tolak/serahkan
  dicabut; halaman jadi riwayat saja.
- POS kasir: label status disesuaikan bila menampilkan tahap AM.

## Panggilan yang saya ambil (boleh dikoreksi)
- Rekening yang diisi di form pengajuan dipakai sebagai rekening tujuan transfer.
- AM tetap boleh melihat riwayat outlet binaannya (read-only).
- Fungsi lama diganti pesan galat, bukan dihapus.
- App native superapp ada di repo terpisah; kalau ia memanggil fungsi AM, ia akan
  menerima pesan galat yang jelas, tidak rusak diam-diam.

## Pendekatan yang dipertimbangkan
- A. Saldo naik saat Finance transfer — ditolak: saldo mendahului uang fisik.
- **B. Leader konfirmasi masuk laci — dipilih.**
- C. Kasir konfirmasi di POS — ditolak: perlu ubah POS web + native + rilis APK.

## Koreksi setelah review akhir (25 Nov 2026)
- **Premis "saldo POS baru naik di `forwarded_by_leader`" SALAH untuk definisi live.**
  `get_petty_cash_snapshot` live juga menghitung `approved_by_finance` (dulu status
  singkat karena Finance segera "serah ke AM"). Migration kini menulis ulang snapshot
  dari definisi live tanpa `approved_by_finance`; pembaca saldo di POS, dashboard
  leader, dan laporan finance disamakan (`STATUS_DANA_DI_LACI`).
- Pengajuan yang **sudah dicairkan** dan berhenti di tahap AM tidak dipindah
  (per 25 Nov: 4 baris, termasuk Mitra Cibubur Rp 500.000 dari 11 Sep); hanya yang
  belum dicairkan dipindah ke Finance.
- `create_petty_cash_topup` menolak outlet di luar `accessible_outlet_ids()`.
- `leader_forward_funds`: hanya leader/admin/owner, dan bukan orang yang mencairkan.
- Penjaga status menolak `approved_by_finance` tanpa bukti untuk penulis mana pun.
- Tidak dibangun: "batal pencairan" (salah transfer) — usulan lanjutan.

