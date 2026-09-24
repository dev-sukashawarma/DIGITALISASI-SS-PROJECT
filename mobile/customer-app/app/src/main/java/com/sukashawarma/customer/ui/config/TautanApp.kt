package com.sukashawarma.customer.ui.config

import java.net.URLEncoder

/** Tautan wa.me siap pakai; null bila config.waCs belum diisi (baris/tombol jangan ditampilkan). */
fun tautanWa(waCs: String?, teks: String): String? {
    if (waCs.isNullOrBlank()) return null
    val isi = URLEncoder.encode(teks, "UTF-8").replace("+", "%20")
    return "https://wa.me/$waCs?text=$isi"
}
