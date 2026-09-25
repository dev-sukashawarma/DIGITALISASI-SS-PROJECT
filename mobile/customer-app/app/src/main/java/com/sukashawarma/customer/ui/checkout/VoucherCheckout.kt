package com.sukashawarma.customer.ui.checkout

import com.sukashawarma.customer.data.PilihanVoucher
import com.sukashawarma.customer.data.api.VoucherCheckoutDto

/**
 * Alasan tombol Bayar dikunci karena voucher; null = tidak dikunci.
 *
 * Voucher yang tidak berlaku lagi SENGAJA tidak dilepas diam-diam: pelanggan
 * memilihnya dengan sengaja, jadi ia yang memutuskan melepas atau memenuhi
 * syaratnya.
 */
fun alasanKunciVoucher(pilihan: PilihanVoucher?, blok: VoucherCheckoutDto?): String? = when {
    pilihan == null -> null
    blok == null -> "Voucher belum bisa dicek. Lepas voucher untuk melanjutkan."
    blok.status == "berlaku" -> null
    else -> blok.alasan ?: "Voucher tidak berlaku untuk pesanan ini."
}

fun labelPotonganVoucher(blok: VoucherCheckoutDto?): String =
    if (blok?.status == "berlaku") "Potongan voucher" else "Potongan Promo"
