package com.sukashawarma.customer.ui.format

import org.junit.Assert.assertEquals
import org.junit.Test

class RupiahTest {

    @Test
    fun `memakai titik sebagai pemisah ribuan`() {
        assertEquals("Rp25.000", rupiah(25_000L))
        assertEquals("Rp1.250.000", rupiah(1_250_000L))
    }

    @Test
    fun `angka di bawah seribu tidak diberi pemisah`() {
        assertEquals("Rp0", rupiah(0L))
        assertEquals("Rp999", rupiah(999L))
    }

    @Test
    fun `membulatkan harga pecahan ke rupiah penuh`() {
        assertEquals("Rp25.000", rupiah(24_999.9999))
        assertEquals("Rp15.001", rupiah(15_000.5))
    }

    @Test
    fun `nilai negatif memakai tanda minus sebelum Rp`() {
        assertEquals("-Rp5.000", rupiah(-5_000L))
    }
}
