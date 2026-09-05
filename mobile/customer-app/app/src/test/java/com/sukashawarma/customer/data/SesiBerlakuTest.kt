package com.sukashawarma.customer.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SesiBerlakuTest {

    /** 2026-09-05T00:00:00.000Z dalam milidetik epoch. */
    private val awalSeptember = 1788566400000L

    @Test
    fun `mengurai format toISOString gateway`() {
        assertEquals(awalSeptember, uraiWaktuIso("2026-09-05T00:00:00.000Z"))
    }

    @Test
    fun `sesi yang belum kedaluwarsa dianggap berlaku`() {
        assertTrue(sesiMasihBerlaku("2026-10-05T00:00:00.000Z", awalSeptember))
    }

    @Test
    fun `sesi yang sudah lewat dianggap tidak berlaku`() {
        assertFalse(sesiMasihBerlaku("2026-08-05T00:00:00.000Z", awalSeptember))
    }

    @Test
    fun `tidak ada sesi berarti tidak berlaku`() {
        assertFalse(sesiMasihBerlaku(null, awalSeptember))
    }

    @Test
    fun `tanggal yang tak bisa diurai dianggap MASIH berlaku`() {
        // Gateway yang menentukan sah atau tidaknya sesi. Mengunci pelanggan
        // di luar karena satu string tak terbaca jauh lebih merugikan
        // daripada satu permintaan yang ditolak server dengan 401.
        assertTrue(sesiMasihBerlaku("entah apa ini", awalSeptember))
        assertTrue(sesiMasihBerlaku("", awalSeptember))
    }
}
