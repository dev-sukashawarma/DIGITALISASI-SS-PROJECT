package com.sukashawarma.customer.ui.format

import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Memformat rupiah seperti yang dipakai struk dan kasir: `Rp25.000`, titik
 * sebagai pemisah ribuan, tanpa desimal.
 *
 * Sengaja TIDAK memakai `NumberFormat.getCurrencyInstance` — hasilnya ikut
 * setelan bahasa perangkat, sehingga HP ber-locale en-US menampilkan
 * "IDR 25,000.00" di layar pelanggan Indonesia.
 *
 * Harga dari gateway berupa Double. Pembulatan dilakukan di sini, sekali, ke
 * rupiah penuh: menampilkan "Rp24.999,999999" karena galat floating point
 * jauh lebih buruk daripada selisih satu rupiah pada tampilan.
 */
fun rupiah(nilai: Double): String = rupiah(nilai.roundToLong())

fun rupiah(nilai: Long): String {
    val negatif = nilai < 0
    val angka = abs(nilai).toString()
    val hasil = StringBuilder()

    for ((i, c) in angka.withIndex()) {
        if (i > 0 && (angka.length - i) % 3 == 0) hasil.append('.')
        hasil.append(c)
    }

    return if (negatif) "-Rp$hasil" else "Rp$hasil"
}
