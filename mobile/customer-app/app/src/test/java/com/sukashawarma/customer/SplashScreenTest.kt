package com.sukashawarma.customer

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SplashScreenTest {

    @Test
    fun `tampil di awal`() {
        assertTrue(splashMasihTampil(mulaiMs = 1_000, sekarangMs = 1_000))
    }

    @Test
    fun `tampil sesaat sebelum tiga detik`() {
        assertTrue(splashMasihTampil(mulaiMs = 1_000, sekarangMs = 1_000 + 2_999))
    }

    @Test
    fun `hilang tepat di tiga detik`() {
        assertFalse(splashMasihTampil(mulaiMs = 1_000, sekarangMs = 1_000 + DURASI_SPLASH_MS))
    }

    @Test
    fun `hilang setelah tiga detik`() {
        assertFalse(splashMasihTampil(mulaiMs = 1_000, sekarangMs = 1_000 + 10_000))
    }

    @Test
    fun `durasinya tiga detik`() {
        assertTrue(DURASI_SPLASH_MS == 3_000L)
    }

    @Test
    fun `waktu mundur menahan splash -- sebabnya MainActivity memakai elapsedRealtime`() {
        // Kalau sumber waktunya jam dinding, lompatan mundur (sinkronisasi NTP,
        // ganti zona waktu) membuat selisihnya negatif dan splash menggantung
        // sampai jam mengejar. Fungsinya memang berperilaku begitu -- itu
        // sebabnya pemanggilnya WAJIB memakai SystemClock.elapsedRealtime(),
        // yang monotonik. Uji ini mengunci alasan itu supaya tidak hilang.
        assertTrue(splashMasihTampil(mulaiMs = 10_000, sekarangMs = 5_000))
    }
}
