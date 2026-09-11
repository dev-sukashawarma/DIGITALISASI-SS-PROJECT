package com.sukashawarma.customer.ui.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TujuanBannerTest {

    @Test
    fun `aksi tidak dikenal jatuh ke TidakAda`() {
        assertEquals(TujuanBanner.TidakAda, tujuanBanner("buka_url", null))
    }

    @Test
    fun `aksi menu memberi tujuan Menu`() {
        assertEquals(TujuanBanner.Menu, tujuanBanner("menu", null))
    }

    @Test
    fun `aksi menu_item tanpa target jatuh ke TidakAda`() {
        assertEquals(TujuanBanner.TidakAda, tujuanBanner("menu_item", null))
    }

    @Test
    fun `aksi menu_item dengan target membawa id`() {
        assertEquals(TujuanBanner.Item("m1"), tujuanBanner("menu_item", "m1"))
    }

    @Test
    fun `popup tanpa id tidak tampil`() {
        assertFalse(popupBolehTampil(null, emptySet()))
    }

    @Test
    fun `popup baru tampil`() {
        assertTrue(popupBolehTampil("b1", emptySet()))
    }

    @Test
    fun `popup yang sudah dilihat tidak tampil lagi`() {
        assertFalse(popupBolehTampil("b1", setOf("b1")))
    }

    @Test
    fun `popup berbeda tetap tampil walau ada yang sudah dilihat`() {
        assertTrue(popupBolehTampil("b2", setOf("b1")))
    }
}
