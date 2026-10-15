package com.sukashawarma.customer.ui.config

import com.sukashawarma.customer.BuildConfig
import java.net.URLEncoder

/** Tautan wa.me siap pakai; null bila config.waCs belum diisi (baris/tombol jangan ditampilkan). */
fun tautanWa(waCs: String?, teks: String): String? {
    if (waCs.isNullOrBlank()) return null
    val isi = URLEncoder.encode(teks, "UTF-8").replace("+", "%20")
    return "https://wa.me/$waCs?text=$isi"
}

/** URL Kebijakan Privasi dengan fallback ke halaman resmi di Retail Gateway bila belum diisi di DB. */
fun urlKebijakanPrivasi(urlPrivasi: String?, baseUrl: String = BuildConfig.GATEWAY_BASE_URL): String =
    urlPrivasi?.trim()?.takeIf { it.isNotEmpty() } ?: "${baseUrl.trimEnd('/')}/privasi"

/** URL Syarat & Ketentuan dengan fallback ke halaman resmi di Retail Gateway bila belum diisi di DB. */
fun urlSyaratKetentuan(urlSyarat: String?, baseUrl: String = BuildConfig.GATEWAY_BASE_URL): String =
    urlSyarat?.trim()?.takeIf { it.isNotEmpty() } ?: "${baseUrl.trimEnd('/')}/syarat"

