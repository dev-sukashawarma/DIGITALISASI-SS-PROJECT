package com.sukashawarma.customer.ui.config

import com.sukashawarma.customer.BuildConfig
import java.net.URLEncoder

/**
 * Tautan wa.me siap pakai; null bila config.waCs belum diisi atau tidak memuat digit.
 * Menormalisasi spasi, tanda hubung, `+`, dan awalan `08...` -> `628...` agar aman
 * walau admin menulis nomor dalam format alami.
 */
fun tautanWa(waCs: String?, teks: String): String? {
    if (waCs.isNullOrBlank()) return null
    val digit = waCs.filter { it.isDigit() }
    if (digit.isEmpty()) return null
    val normal = when {
        digit.startsWith("0") -> "62${digit.drop(1)}"
        else -> digit
    }
    val isi = URLEncoder.encode(teks, "UTF-8").replace("+", "%20")
    return "https://wa.me/$normal?text=$isi"
}

private fun urlHttpSah(url: String?): String? {
    val bersih = url?.trim() ?: return null
    val lower = bersih.lowercase()
    return if (lower.startsWith("https://") || lower.startsWith("http://")) bersih else null
}

/** URL Kebijakan Privasi dengan fallback ke halaman resmi di Retail Gateway bila kosong/tak berskema http(s). */
fun urlKebijakanPrivasi(urlPrivasi: String?, baseUrl: String = BuildConfig.GATEWAY_BASE_URL): String =
    urlHttpSah(urlPrivasi) ?: "${baseUrl.trimEnd('/')}/privasi"

/** URL Syarat & Ketentuan dengan fallback ke halaman resmi di Retail Gateway bila kosong/tak berskema http(s). */
fun urlSyaratKetentuan(urlSyarat: String?, baseUrl: String = BuildConfig.GATEWAY_BASE_URL): String =
    urlHttpSah(urlSyarat) ?: "${baseUrl.trimEnd('/')}/syarat"
