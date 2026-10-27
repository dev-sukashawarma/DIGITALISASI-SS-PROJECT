package com.sukashawarma.superapp.ui.features.pengantaran

import org.junit.Assert.assertEquals
import org.junit.Test

class UsulanUrutanTest {

    private fun sj(id: String, outlet: String, lat: Double?, lng: Double?) =
        SjSiap(suratJalanId = id, documentNumber = "SJ-$id", outletId = outlet, outletName = outlet, lat = lat, lng = lng, jumlahItem = 1)

    @Test
    fun urutTerdekatBerantai() {
        // Titik mulai -6.60; outlet di garis lurus ke selatan, input diacak.
        val hasil = UsulanUrutan.susun(-6.60, 106.80, listOf(
            sj("c", "C", -6.63, 106.80),
            sj("a", "A", -6.61, 106.80),
            sj("b", "B", -6.62, 106.80),
        ))
        assertEquals(listOf("a", "b", "c"), hasil.map { it.suratJalanId })
    }

    @Test
    fun outletTanpaKoordinatDiAkhirUrutanAsli() {
        val hasil = UsulanUrutan.susun(-6.60, 106.80, listOf(
            sj("x", "X", null, null),
            sj("b", "B", -6.62, 106.80),
            sj("y", "Y", null, null),
            sj("a", "A", -6.61, 106.80),
        ))
        assertEquals(listOf("a", "b", "x", "y"), hasil.map { it.suratJalanId })
    }

    @Test
    fun sjOutletSamaBerdampingan() {
        val hasil = UsulanUrutan.susun(-6.60, 106.80, listOf(
            sj("a1", "A", -6.61, 106.80),
            sj("b", "B", -6.62, 106.80),
            sj("a2", "A", -6.61, 106.80),
        ))
        assertEquals(listOf("a1", "a2", "b"), hasil.map { it.suratJalanId })
    }
}
