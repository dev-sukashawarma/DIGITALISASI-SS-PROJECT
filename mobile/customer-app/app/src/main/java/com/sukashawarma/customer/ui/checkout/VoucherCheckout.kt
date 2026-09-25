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

/**
 * Boleh menampilkan alasan kunci voucher (M2).
 *
 * `alasanKunciVoucher` sendiri tidak tahu soal `state.alasan`/`state.masalah`
 * -- sebab lain yang JUGA mengunci Bayar (keranjang berubah, outlet tutup,
 * menu habis, dst; lihat `CheckoutState.bolehLanjut`). Kalau salah satu dari
 * itu aktif, alasan kunci voucher DISEMBUNYIKAN: melepas voucher tidak akan
 * membuka Bayar sama sekali selama sebab lain itu masih ada, jadi menyuruh
 * pelanggan "lepas voucher untuk melanjutkan" menyesatkan. `bolehLanjut`
 * SENDIRI TIDAK BERUBAH -- ini murni aturan tampilan.
 */
fun tampilkanAlasanKunciVoucher(state: CheckoutState): Boolean =
    state.alasan == null && state.masalah.isEmpty()
