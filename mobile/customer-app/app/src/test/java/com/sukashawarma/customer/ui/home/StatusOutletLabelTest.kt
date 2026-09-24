package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusOutletLabelTest {
    private fun o(bisa: Boolean?, aktif: Boolean = true, pesan: String? = null, terakhir: String? = null) =
        OutletDto(id = "a", name = "A", isActive = aktif, bisaPesan = bisa, pesanStatus = pesan, pesanTerakhir = terakhir)

    @Test fun `gateway lama tanpa bisa_pesan jatuh ke isActive`() {
        assertTrue(o(null, aktif = true).bolehPesan())
        assertFalse(o(null, aktif = false).bolehPesan())
    }
    @Test fun `bisa_pesan false menang atas isActive`() = assertFalse(o(false, aktif = true).bolehPesan())

    @Test fun `label buka menyebut pesan terakhir dalam WIB`() =
        assertEquals("Buka · pesan terakhir 21.30", labelStatusOutlet(o(true, terakhir = "2026-09-24T14:30:00.000Z")))

    @Test fun `label tutup memakai kalimat gateway`() =
        assertEquals("Outlet belum buka. Buka pukul 14.00.", labelStatusOutlet(o(false, pesan = "Outlet belum buka. Buka pukul 14.00.")))

    @Test fun `tutup tanpa kalimat gateway`() = assertEquals("Tutup", labelStatusOutlet(o(false)))
}
