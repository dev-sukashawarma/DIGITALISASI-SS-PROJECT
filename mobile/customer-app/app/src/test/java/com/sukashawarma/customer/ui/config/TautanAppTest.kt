package com.sukashawarma.customer.ui.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TautanAppTest {
    @Test fun `wa kosong tidak menampilkan tautan`() = assertNull(tautanWa(null, "Halo"))
    @Test fun `teks di-encode`() =
        assertEquals("https://wa.me/6281234567890?text=Pesanan%20%2312", tautanWa("6281234567890", "Pesanan #12"))
}
