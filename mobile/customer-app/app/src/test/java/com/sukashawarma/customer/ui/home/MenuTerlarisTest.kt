package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.MenuItemDto
import org.junit.Assert.assertEquals
import org.junit.Test

class MenuTerlarisTest {

    private fun m(id: String, nama: String = id, ada: Boolean = true) =
        MenuItemDto(id = id, name = nama, price = 10000.0, isAvailable = ada)

    private val katalog = listOf(
        m("es", "Ice Tea"),
        m("ayam", "Original Ayam Jumbo"),
        m("sapi", "Original Sapi Besar"),
        m("kentang", "Extra Kentang", ada = false),
    )

    private fun ids(hasil: List<MenuItemDto>) = hasil.map { it.id }

    @Test
    fun `urutan kurasi admin dipakai`() {
        assertEquals(listOf("sapi", "es"), ids(pilihMenuTerlaris(katalog, listOf("sapi", "es", "ayam"))))
    }

    @Test
    fun `menu habis atau tidak dijual di outlet dilewati, cadangan naik`() {
        assertEquals(listOf("ayam", "es"), ids(pilihMenuTerlaris(katalog, listOf("kentang", "tidak-ada", "ayam", "es"))))
    }

    @Test
    fun `kurasi kosong memakai aturan lama Ayam lalu Sapi`() {
        assertEquals(listOf("ayam", "sapi"), ids(pilihMenuTerlaris(katalog, emptyList())))
    }

    @Test
    fun `semua pilihan admin habis juga memakai aturan lama`() {
        assertEquals(listOf("ayam", "sapi"), ids(pilihMenuTerlaris(katalog, listOf("kentang"))))
    }

    @Test
    fun `aturan lama tanpa Ayam atau Sapi mengambil menu tersedia pertama`() {
        val lain = listOf(m("a", "Kebab"), m("b", "Burger", ada = false), m("c", "Roti"))
        assertEquals(listOf("a", "c"), ids(pilihMenuTerlaris(lain, emptyList())))
    }

    @Test
    fun `kurasi hanya satu yang tersedia tetap satu, tidak dicampur aturan lama`() {
        assertEquals(listOf("es"), ids(pilihMenuTerlaris(katalog, listOf("es", "kentang"))))
    }
}
