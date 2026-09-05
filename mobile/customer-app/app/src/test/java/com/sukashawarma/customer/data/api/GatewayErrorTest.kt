package com.sukashawarma.customer.data.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GatewayErrorTest {

    @Test
    fun `401 selalu berarti sesi tidak sah`() {
        assertEquals(GatewayError.SesiTidakSah, petakanGalat(401, """{"error":"Sesi tidak sah"}"""))
    }

    @Test
    fun `409 pesanan kadaluarsa dikenali sebagai kode mesin`() {
        val hasil = petakanGalat(409, """{"error":"pesanan_kadaluarsa","pesan":"Pesanan sebelumnya sudah kedaluwarsa."}""")
        assertTrue(hasil is GatewayError.Kode)
        assertEquals("pesanan_kadaluarsa", (hasil as GatewayError.Kode).kode)
    }

    @Test
    fun `409 pesanan sedang diproses dikenali sebagai kode mesin`() {
        val hasil = petakanGalat(409, """{"error":"pesanan_sedang_diproses","pesan":"Coba lagi sebentar."}""")
        assertEquals("pesanan_sedang_diproses", (hasil as GatewayError.Kode).kode)
    }

    @Test
    fun `galat berupa kalimat bebas tetap terbaca, bukan crash`() {
        val hasil = petakanGalat(409, """{"error":"Outlet sedang tidak bisa menerima pesanan"}""")
        assertTrue(hasil is GatewayError.Kode)
        assertEquals("Outlet sedang tidak bisa menerima pesanan", (hasil as GatewayError.Kode).pesan)
    }

    @Test
    fun `502 dipetakan sebagai galat server, bukan kesalahan pengguna`() {
        assertTrue(petakanGalat(502, """{"error":"Gagal memuat menu"}""") is GatewayError.Server)
    }

    @Test
    fun `body kosong atau bukan JSON tidak membuat aplikasi crash`() {
        assertTrue(petakanGalat(500, null) is GatewayError.Server)
        assertTrue(petakanGalat(500, "<html>gateway timeout</html>") is GatewayError.Server)
    }
}
