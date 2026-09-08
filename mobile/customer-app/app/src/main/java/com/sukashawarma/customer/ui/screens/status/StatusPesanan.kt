package com.sukashawarma.customer.ui.screens.status

/** Tiga tahap yang dilihat pelanggan. */
enum class TahapPesanan { DITERIMA, DIBUAT, SIAP }

data class TampilanStatus(
    val judul: String,
    val penjelasan: String,
    /** Tahap terakhir yang sudah tercapai; null berarti pesanan tidak berjalan. */
    val tahap: TahapPesanan?,
    val selesai: Boolean = false,
    val dibatalkan: Boolean = false
)

/**
 * Memetakan status dapur ke tampilan pelanggan.
 *
 * Nilai yang mungkin diverifikasi ke DATABASE PRODUKSI, bukan ditebak:
 *
 * ```
 * orders_status_check:
 *   status IN ('pending','preparing','ready','completed','cancelled')
 * ```
 *
 * Catatan penting: pesanan aplikasi masuk langsung sebagai `preparing`
 * (`susunPayloadPos` menetapkannya), jadi `pending` praktis tidak pernah
 * terlihat untuk pesanan dari aplikasi. Ia tetap dipetakan karena kasir bisa
 * mengubah status lewat POS, dan status yang tidak dikenal tidak boleh
 * menghasilkan layar kosong.
 *
 * `status_dapur` bernilai null selama pesanan belum terdorong ke kasir --
 * yaitu selama pembayaran belum dikonfirmasi.
 */
fun tampilanStatus(statusDapur: String?): TampilanStatus = when (statusDapur) {
    null -> TampilanStatus(
        judul = "Menunggu pembayaran",
        penjelasan = "Pesanan diteruskan ke dapur setelah pembayaran dikonfirmasi.",
        tahap = null
    )
    "pending" -> TampilanStatus(
        judul = "Pesanan diterima",
        penjelasan = "Pesananmu sudah masuk ke kasir.",
        tahap = TahapPesanan.DITERIMA
    )
    "preparing" -> TampilanStatus(
        judul = "Sedang dibuat",
        penjelasan = "Dapur sedang menyiapkan pesananmu.",
        tahap = TahapPesanan.DIBUAT
    )
    "ready" -> TampilanStatus(
        judul = "Siap diambil",
        penjelasan = "Sebutkan nomor pesananmu di kasir.",
        tahap = TahapPesanan.SIAP
    )
    "completed" -> TampilanStatus(
        judul = "Sudah diambil",
        penjelasan = "Pesanan ini sudah selesai. Terima kasih!",
        tahap = TahapPesanan.SIAP,
        selesai = true
    )
    "cancelled" -> TampilanStatus(
        judul = "Dibatalkan",
        penjelasan = "Pesanan ini dibatalkan. Hubungi outlet kalau kamu merasa ini keliru.",
        tahap = null,
        dibatalkan = true
    )
    // Status asing tidak boleh menghasilkan layar kosong di tangan pelanggan
    // yang sedang menunggu makanannya.
    else -> TampilanStatus(
        judul = "Sedang diproses",
        penjelasan = "Pesananmu sedang ditangani outlet.",
        tahap = TahapPesanan.DITERIMA
    )
}

/**
 * Apakah satu tahap sudah tercapai.
 *
 * Pesanan aplikasi masuk langsung sebagai `preparing`, jadi tahap "Diterima"
 * harus ikut tertandai selesai ketika pesanan sudah sampai tahap berikutnya --
 * kalau tidak, garis waktunya menunjukkan pesanan melompati tahap pertama.
 */
fun tahapTercapai(tahapSekarang: TahapPesanan?, tahap: TahapPesanan): Boolean {
    if (tahapSekarang == null) return false
    return tahap.ordinal <= tahapSekarang.ordinal
}
