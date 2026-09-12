package com.sukashawarma.customer.ui.payment

import com.sukashawarma.customer.data.api.GatewayError
import java.util.UUID

/**
 * Menentukan `client_order_id` untuk percobaan berikutnya.
 *
 * Ini bagian paling mudah salah di seluruh aplikasi, dan salahnya mahal ke
 * dua arah:
 *
 * - **Memakai ulang id setelah draftnya kedaluwarsa** mengunci pelanggan.
 *   `retail.order_drafts.client_order_id` berkendala UNIQUE, jadi gateway
 *   membalas 409 selamanya dan pesanan itu tidak akan pernah bisa dibuat.
 * - **Membuat id baru saat percobaan sebelumnya masih diproses** menghasilkan
 *   DUA tagihan Xendit untuk satu keranjang. Pelanggan tertagih dua kali.
 *
 * Karena itu id hanya diganti pada satu kondisi yang benar-benar spesifik,
 * dan setiap kondisi lain -- termasuk galat jaringan, yang justru paling
 * sering terjadi -- mempertahankan id yang sama.
 */
fun idBerikutnya(idSekarang: String, galat: GatewayError): String =
    when {
        galat is GatewayError.Kode && galat.kode == "pesanan_kadaluarsa" ->
            UUID.randomUUID().toString()
        else -> idSekarang
    }

fun idPesananBaru(): String = UUID.randomUUID().toString()

/** Nasib satu percobaan pemesanan yang tertinggal. */
enum class NasibPercobaan {
    /** Masih hidup: pantau statusnya, JANGAN buat pesanan kedua. */
    LANJUTKAN,

    /** Sudah selesai dibayar. */
    DIBAYAR,

    /** Pembayaran ditolak. */
    GAGAL,

    /** Mati: batas waktu lewat atau draft dihanguskan. Mulai pesanan baru. */
    MULAI_BARU
}

/**
 * Menentukan apa yang harus dilakukan pada percobaan pemesanan yang masih
 * tersimpan saat layar pembayaran dibuka.
 *
 * Ini menutup celah nyata: percobaan yang batas waktunya sudah lewat tetap
 * dipantau seolah masih hidup. Pelanggan menonton pemuat lima menit penuh,
 * lalu diberi pesan "belum ada kabar" -- padahal yang benar adalah "batas
 * waktunya sudah lewat".
 *
 * Dua kehati-hatian yang tidak boleh dilonggarkan:
 *
 * 1. **`expires_at` yang tidak diketahui BUKAN alasan membuang percobaan.**
 *    Gateway lama tidak mengirimnya. Membuang percobaan atas dasar tebakan
 *    berarti membuat tagihan kedua untuk pesanan yang mungkin masih hidup.
 * 2. **Status yang tidak dikenal diperlakukan sebagai masih hidup.** Arah
 *    aman di sini adalah menunggu, bukan menagih ulang.
 */
fun nasibPercobaan(
    status: String,
    expiresAt: String?,
    sekarang: Long,
    uraiWaktu: (String) -> Long? = { com.sukashawarma.customer.data.uraiWaktuIso(it) }
): NasibPercobaan = when (status) {
    "dibayar" -> NasibPercobaan.DIBAYAR
    "gagal" -> NasibPercobaan.GAGAL
    "kadaluarsa" -> NasibPercobaan.MULAI_BARU
    "menunggu_bayar" -> {
        val batas = expiresAt?.let(uraiWaktu)
        // Batas tak terbaca -> anggap masih hidup. Lihat catatan 1 di atas.
        if (batas != null && batas <= sekarang) NasibPercobaan.MULAI_BARU
        else NasibPercobaan.LANJUTKAN
    }
    else -> NasibPercobaan.LANJUTKAN
}
