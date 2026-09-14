/**
 * Saklar: apakah omzet TikTok GO dashboard mitra diambil dari `platform_settlements`
 * (menimpa angka dari order POS), atau tetap dari order.
 *
 * DIMATIKAN 2026-09-14. Isi `platform_settlements` untuk `tiktokgo` tidak bisa
 * dipakai sebagai omzet:
 *
 * - Pengisinya (`source_file = 'hermes_api_inject'`) jalan kira-kira tiap 3 hari
 *   dan setiap kali menulis ULANG angka yang sama persis dengan `tanggal` baru.
 *   Contoh MITRA CIBUBUR: 9 baris (15 Agu s/d 6 Sep) semuanya omzet Rp 7.441.000
 *   dan 160 transaksi. Pola yang sama di ketujuh outlet yang punya data.
 * - Pengisinya berhenti sejak 7 September; Cicurug & Cileungsi tidak punya baris.
 *
 * Karena baris-baris kembar itu dijumlahkan sementara HPP tetap dari order, omzet
 * TikTok membengkak tanpa biaya pendamping, dan laba + bagi hasil ikut membengkak:
 * +Rp 13,7 jt untuk 1–13 Sep, +Rp 110,6 jt untuk rentang 15 Agu–14 Sep.
 *
 * Agustus 2026 TIDAK terpengaruh saklar ini: periode itu memakai data closing
 * hasil audit (`mitraPnlClosingData.ts`) dan penimpaan settlement memang sudah
 * dilewati untuk Agustus.
 *
 * Nyalakan kembali HANYA setelah (1) pengisi diperbaiki agar satu baris mewakili
 * satu tanggal penjualan, dan (2) baris kembar yang sudah terlanjur masuk dibersihkan.
 * Dipakai bersama oleh `actions/mitraPnl.ts` dan `actions/mitraRoi.ts` — jangan
 * disalin ke masing-masing berkas, supaya keduanya tidak bisa bersikap berbeda.
 */
export const PAKAI_SETTLEMENT_TIKTOK = false
