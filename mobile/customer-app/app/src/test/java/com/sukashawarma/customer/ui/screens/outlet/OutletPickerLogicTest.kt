package com.sukashawarma.customer.ui.screens.outlet

import com.sukashawarma.customer.data.api.OutletDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private fun outlet(id: String, nama: String, alamat: String? = null, aktif: Boolean = true) =
    OutletDto(id = id, name = nama, address = alamat, lat = null, lng = null, isActive = aktif)

class OutletPickerLogicTest {

    @Test
    fun `outlet yang buka diurutkan di atas yang belum buka`() {
        val hasil = urutkanOutlet(
            listOf(
                outlet("a", "Antapani", aktif = false),
                outlet("b", "Bantarjati", aktif = true),
            )
        )
        assertEquals(listOf("b", "a"), hasil.map { it.id })
    }

    @Test
    fun `outlet dengan status sama diurutkan alfabetis`() {
        val hasil = urutkanOutlet(
            listOf(outlet("c", "Cibubur"), outlet("a", "Antapani"), outlet("b", "Bantarjati"))
        )
        assertEquals(listOf("Antapani", "Bantarjati", "Cibubur"), hasil.map { it.name })
    }

    @Test
    fun `pencarian mencocokkan nama maupun alamat`() {
        val semua = listOf(
            outlet("a", "Suka Shawarma Empang", "Jl. Empang Raya No. 24, Bogor Selatan"),
            outlet("b", "Suka Shawarma Cibubur", "Jl. Alternatif Cibubur KM 3, Depok"),
        )
        assertEquals(listOf("a"), saringOutlet(semua, "empang").map { it.id })
        assertEquals(listOf("b"), saringOutlet(semua, "Depok").map { it.id })
    }

    @Test
    fun `outlet tanpa alamat tidak menyebabkan crash saat dicari`() {
        val semua = listOf(outlet("a", "Suka Shawarma Empang", alamat = null))
        assertTrue(saringOutlet(semua, "bogor").isEmpty())
        assertEquals(1, saringOutlet(semua, "empang").size)
    }

    @Test
    fun `kueri kosong mengembalikan seluruh outlet`() {
        val semua = listOf(outlet("a", "Empang"), outlet("b", "Cibubur"))
        assertEquals(2, saringOutlet(semua, "   ").size)
    }
}
