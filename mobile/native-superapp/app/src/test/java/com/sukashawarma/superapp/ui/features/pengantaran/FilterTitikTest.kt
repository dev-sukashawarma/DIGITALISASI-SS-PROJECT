package com.sukashawarma.superapp.ui.features.pengantaran

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FilterTitikTest {

    // 0,00001° lintang ≈ 1,11 m
    private fun titik(detik: Long, meterKeSelatan: Double) =
        Titik(lat = -6.6 - meterKeSelatan / 111_320.0, lng = 106.8, waktuMs = detik * 1000)

    private val awal = titik(0, 0.0)

    @Test
    fun titikPertamaSelaluDikirim() {
        assertTrue(FilterTitik(Pengaturan()).perluKirim(awal, null))
    }

    @Test
    fun lewatIntervalDikirimWalauDekat() {
        assertTrue(FilterTitik(Pengaturan()).perluKirim(titik(31, 5.0), awal))
    }

    @Test
    fun pindahJauhDikirimSebelumInterval() {
        assertTrue(FilterTitik(Pengaturan()).perluKirim(titik(10, 120.0), awal))
    }

    @Test
    fun dekatDanCepatDibuang() {
        assertFalse(FilterTitik(Pengaturan()).perluKirim(titik(10, 10.0), awal))
    }

    @Test
    fun pengaturanBaruBerlaku() {
        val f = FilterTitik(Pengaturan())
        f.pengaturan = Pengaturan(intervalDetik = 60)
        assertFalse(f.perluKirim(titik(31, 5.0), awal))
    }
}
