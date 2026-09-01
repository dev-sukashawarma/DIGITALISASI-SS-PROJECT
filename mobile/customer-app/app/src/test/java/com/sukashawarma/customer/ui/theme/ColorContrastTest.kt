package com.sukashawarma.customer.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

private fun luminansi(rgb: Long): Double {
    fun kanal(c: Int): Double {
        val s = c / 255.0
        return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4)
    }
    val r = kanal(((rgb shr 16) and 0xFF).toInt())
    val g = kanal(((rgb shr 8) and 0xFF).toInt())
    val b = kanal((rgb and 0xFF).toInt())
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

private fun kontras(a: Long, b: Long): Double {
    val la = luminansi(a); val lb = luminansi(b)
    val terang = maxOf(la, lb); val gelap = minOf(la, lb)
    return (terang + 0.05) / (gelap + 0.05)
}

class ColorContrastTest {
    private val brown = 0x701604L
    private val orange = 0xF29744L
    private val ink = 0x400A07L
    private val putih = 0xFFFFFFL
    private val cream = 0xFFF7EDL

    @Test
    fun `tombol utama coklat dengan teks putih lulus AAA`() {
        assertTrue(kontras(brown, putih) >= 7.0)
    }

    @Test
    fun `aksen oranye dengan teks ink lulus AAA`() {
        assertTrue(kontras(orange, ink) >= 7.0)
    }

    @Test
    fun `teks putih di atas oranye GAGAL - kombinasi ini dilarang`() {
        assertTrue(
            "Kalau ini lulus, seseorang mengubah palet. Teks putih di atas oranye tidak terbaca di bawah matahari.",
            kontras(orange, putih) < 4.5
        )
    }

    @Test
    fun `teks ink di atas krem lulus AAA`() {
        assertTrue(kontras(cream, ink) >= 7.0)
    }
}
