package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException

class PengirimAntreanTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private class ApiPalsu(var gagalPadaPanggilan: Int = -1, var status: String = "berjalan") : PengantaranApi {
        val ukuranBatch = mutableListOf<Int>()
        override suspend fun kirimLokasi(titik: List<Titik>): HasilKirim {
            if (ukuranBatch.size == gagalPadaPanggilan) {
                ukuranBatch += -1
                throw IOException("sinyal hilang")
            }
            ukuranBatch += titik.size
            return HasilKirim(status, Pengaturan(), titik.size)
        }
        override suspend fun sjSiap() = TODO()
        override suspend fun mulai(sjIds: List<String>, lat: Double, lng: Double) = TODO()
        override suspend fun ubahUrutan(perjalananId: String, stopIds: List<String>) = TODO()
        override suspend fun tandaiTiba(stopId: String, lat: Double, lng: Double, akurasiM: Float?) = TODO()
        override suspend fun selesaikan(perjalananId: String) = TODO()
        override suspend fun perjalananAktif() = TODO()
    }

    private fun antreanIsi(n: Int) = AntreanTitik(tmp.newFile("q.jsonl")).apply {
        repeat(n) { tambah(Titik(lat = -6.6, lng = 106.8, waktuMs = it.toLong())) }
    }

    @Test
    fun seribuDuaRatusTitikDikirimTigaBatch() = runTest {
        val api = ApiPalsu()
        val q = antreanIsi(1200)
        val hasil = PengirimAntrean(api, q).kirimSemua()
        assertEquals(listOf(500, 500, 200), api.ukuranBatch)
        assertEquals(0, q.jumlah())
        assertEquals("berjalan", hasil!!.statusPerjalanan)
    }

    @Test
    fun gagalJaringanTidakMenghilangkanTitik() = runTest {
        val api = ApiPalsu(gagalPadaPanggilan = 1)
        val q = antreanIsi(1200)
        PengirimAntrean(api, q).kirimSemua()
        assertEquals(700, q.jumlah())
    }

    @Test
    fun statusDitutupDiteruskan() = runTest {
        val api = ApiPalsu(status = "ditutup_otomatis")
        val hasil = PengirimAntrean(api, antreanIsi(3)).kirimSemua()
        assertEquals("ditutup_otomatis", hasil!!.statusPerjalanan)
    }

    @Test
    fun antreanKosongTidakMemanggilServer() = runTest {
        val api = ApiPalsu()
        assertNull(PengirimAntrean(api, antreanIsi(0)).kirimSemua())
        assertEquals(emptyList<Int>(), api.ukuranBatch)
    }
}
