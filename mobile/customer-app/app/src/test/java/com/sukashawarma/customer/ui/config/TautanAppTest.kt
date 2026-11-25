package com.sukashawarma.customer.ui.config

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TautanAppTest {
    @Test fun `wa kosong tidak menampilkan tautan`() = assertNull(tautanWa(null, "Halo"))

    @Test fun `teks di-encode`() =
        assertEquals("https://wa.me/6281234567890?text=Pesanan%20%2312", tautanWa("6281234567890", "Pesanan #12"))

    @Test fun `nomor wa alami dinormalisasi ke 62`() =
        assertEquals("https://wa.me/6281234567890?text=Halo", tautanWa(" 0812-3456-7890 ", "Halo"))

    @Test fun `url legal tanpa skema http jatuh ke halaman gateway`() {
        assertEquals(
            "https://retail.sukashawarma.com/privasi",
            urlKebijakanPrivasi("sukashawarma.com/privasi", "https://retail.sukashawarma.com")
        )
        assertEquals(
            "https://example.com/syarat",
            urlSyaratKetentuan(" https://example.com/syarat ", "https://retail.sukashawarma.com")
        )
    }
}
