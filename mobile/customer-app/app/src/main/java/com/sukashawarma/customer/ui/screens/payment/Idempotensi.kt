package com.sukashawarma.customer.ui.screens.payment

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
