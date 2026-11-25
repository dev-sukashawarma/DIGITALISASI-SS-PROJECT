package com.sukashawarma.customer.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.pow

private fun luminansi(c: Color): Double {
    val rgb = c.toArgb()
    fun kanal(v: Int): Double {
        val s = v / 255.0
        return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4)
    }
    val r = kanal((rgb shr 16) and 0xFF)
    val g = kanal((rgb shr 8) and 0xFF)
    val b = kanal(rgb and 0xFF)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

private fun kontras(a: Color, b: Color): Double {
    val la = luminansi(a)
    val lb = luminansi(b)
    val terang = maxOf(la, lb)
    val gelap = minOf(la, lb)
    return (terang + 0.05) / (gelap + 0.05)
}

/** Mengimpor token warna langsung dari Color.kt agar perubahan palet langsung teruji. */
class ColorContrastTest {
    @Test
    fun `tombol utama coklat dengan teks putih lulus AAA`() {
        assertTrue(kontras(SukaBrown, Color.White) >= 7.0)
    }

    @Test
    fun `aksen oranye dengan teks ink lulus AAA`() {
        assertTrue(kontras(SukaOrange, SukaInk) >= 7.0)
    }

    @Test
    fun `teks putih di atas oranye GAGAL - kombinasi ini dilarang`() {
        assertTrue(
            "Teks putih di atas oranye tidak terbaca di bawah matahari.",
            kontras(SukaOrange, Color.White) < 4.5
        )
    }

    @Test
    fun `teks ink dan brown di atas krem lulus AAA`() {
        assertTrue(kontras(SukaCream, SukaInk) >= 7.0)
        assertTrue(kontras(SukaCream, SukaBrown) >= 7.0)
    }

    @Test
    fun `teks SukaBody di atas krem dan putih lulus WCAG AA`() {
        assertTrue(kontras(SukaCream, SukaBody) >= 4.5)
        assertTrue(kontras(Color.White, SukaBody) >= 4.5)
    }
}
