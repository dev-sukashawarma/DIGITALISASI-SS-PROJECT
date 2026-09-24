package com.sukashawarma.customer.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class InisialTest {

    @Test
    fun `dua kata pertama dari nama`() {
        assertEquals("DS", inisialNama("developer sukashawarma"))
        assertEquals("AB", inisialNama("Andi Budi Cahyo"))
    }

    @Test
    fun `satu kata jadi satu huruf`() {
        assertEquals("A", inisialNama("andi"))
    }

    @Test
    fun `spasi berlebih tidak menghasilkan huruf kosong`() {
        assertEquals("AB", inisialNama("  andi    budi  "))
    }

    @Test
    fun `nama kosong jatuh ke email`() {
        assertEquals("D", inisialNama(null, "dev@contoh.com"))
        assertEquals("D", inisialNama("   ", "dev@contoh.com"))
    }

    @Test
    fun `tanpa nama dan email tidak pernah menebak orang lain`() {
        assertEquals("?", inisialNama(null, null))
    }
}
