package com.sukashawarma.customer.ui.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InformasiAkunTest {

    @Test
    fun `inisial dari dua kata pertama`() {
        assertEquals("MY", InformasiAkun.inisial("Maulana Yusuf"))
        assertEquals("MY", InformasiAkun.inisial("maulana yusuf ibrahim"))
    }

    @Test
    fun `inisial satu kata`() {
        assertEquals("M", InformasiAkun.inisial("Maulana"))
    }

    @Test
    fun `inisial tahan spasi berlebih`() {
        assertEquals("MY", InformasiAkun.inisial("  Maulana    Yusuf  "))
    }

    @Test
    fun `nama kosong jatuh ke SS`() {
        assertEquals("SS", InformasiAkun.inisial(null))
        assertEquals("SS", InformasiAkun.inisial("   "))
    }

    @Test
    fun `teks kosong dianggap tidak ada`() {
        assertNull(InformasiAkun.teksAtauNull(null))
        assertNull(InformasiAkun.teksAtauNull("  "))
        assertEquals("08123", InformasiAkun.teksAtauNull(" 08123 "))
    }
}
