package com.sukashawarma.superapp.ui.features.pengantaran

import org.junit.Assert.assertEquals
import org.junit.Test

class JamWibTest {
    @Test
    fun isoPostgresKeJamWib() {
        assertEquals("09:40", jamWib("2026-10-27T02:40:00+00:00"))
        assertEquals("10:12", jamWib("2026-10-27T03:12:59.123456+00:00"))
        assertEquals("07:05", jamWib("2026-10-27T00:05:00Z"))
    }

    @Test
    fun offsetSelainUtcDihormati() {
        assertEquals("09:40", jamWib("2026-10-27T09:40:00+07:00"))
    }

    @Test
    fun formatJarakSamaDenganWeb() {
        assertEquals("35 m", formatJarak(35.4))
        assertEquals("4,2 km", formatJarak(4200.0))
    }
}
