package com.sukashawarma.customer.ui.screens.checkout

import com.sukashawarma.customer.data.api.CartProblemDto
import com.sukashawarma.customer.ui.format.rupiah

/**
 * Menerjemahkan satu masalah keranjang jadi kalimat yang bisa dibaca
 * pelanggan.
 *
 * Kode mesin (`habis`, `harga_berubah`, `tidak_ada`) TIDAK PERNAH sampai ke
 * layar. Jenis yang tidak dikenal tetap menghasilkan kalimat -- gateway boleh
 * menambah jenis baru kapan saja, dan versi aplikasi lama tidak boleh
 * menampilkan ruang kosong di titik pembayaran.
 */
fun pesanUntukMasalah(masalah: CartProblemDto): String = when (masalah.jenis) {
    "habis" ->
        "${masalah.name} sedang habis."
    "harga_berubah" -> {
        val harga = masalah.hargaBaru
        if (harga != null) {
            "Harga ${masalah.name} berubah jadi ${rupiah(harga)}."
        } else {
            "Harga ${masalah.name} berubah."
        }
    }
    "tidak_ada" ->
        "${masalah.name} sudah tidak ada di menu outlet ini."
    else ->
        "${masalah.name} tidak bisa dipesan saat ini."
}

/**
 * Label tombol pemulihan untuk satu masalah.
 *
 * Harga yang berubah bisa DITERIMA; item yang habis atau hilang hanya bisa
 * dibuang. Keduanya tetap menyisakan keranjang -- rencana melarang membuang
 * seluruh keranjang, dan memang harus begitu: pelanggan sudah memilih
 * item-item lainnya dengan sengaja.
 */
fun labelTindakan(masalah: CartProblemDto): String = when (masalah.jenis) {
    "harga_berubah" -> "Pakai harga baru"
    else -> "Hapus dari keranjang"
}

/**
 * Menerjemahkan `alasan` tingkat-pesanan dari gateway.
 *
 * Ini terpisah dari [pesanUntukMasalah]: `alasan` menjelaskan kenapa SELURUH
 * pesanan ditolak, bukan satu itemnya.
 */
fun pesanUntukAlasan(alasan: String?, pesanDariGateway: String?): String = when (alasan) {
    "outlet_tutup" ->
        "Outlet sedang tutup, jadi pesanan belum bisa diproses."
    "outlet_tidak_melayani" ->
        "Outlet ini belum melayani pesanan lewat aplikasi."
    "keranjang_berubah" ->
        "Ada yang berubah di menu outlet sejak kamu memilih."
    // Gateway mengirim kalimatnya sendiri untuk sebagian penolakan.
    // Kalimat itu lebih spesifik daripada tebakan apa pun di sini.
    else -> pesanDariGateway ?: "Pesanan belum bisa diproses."
}
