package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PengantaranViewModelTest {

    private fun stop(id: String, urutan: Int, status: String = "menunggu") =
        StopUi(id, "sj-$id", "SJ-$id", "Outlet $id", urutan, status, null, null, null)

    private class ApiPalsu : PengantaranApi {
        var aktif: PerjalananUi? = null
        var siap = listOf(
            SjSiap("a", "SJ-A", "oa", "A", -6.61, 106.8, 2),
            SjSiap("b", "SJ-B", "ob", "B", -6.62, 106.8, 3),
        )
        var mulaiGagal: String? = null
        var mulaiDipanggil: List<String>? = null
        var hasilTiba = HasilTiba(30.0, "berjalan")
        var tibaGagal: String? = null
        var aktifGagalSekali = false
        var selesaiDipanggil = 0

        override suspend fun sjSiap() = siap
        override suspend fun mulai(sjIds: List<String>, lat: Double, lng: Double): Pair<String, Pengaturan> {
            mulaiGagal?.let { throw RuntimeException(it) }
            mulaiDipanggil = sjIds
            aktif = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), sjIds.mapIndexed { i, s -> StopUi("st$s", s, null, s, i + 1, "menunggu", null, null, null) })
            return "p1" to Pengaturan()
        }
        override suspend fun ubahUrutan(perjalananId: String, stopIds: List<String>) {}
        override suspend fun tandaiTiba(stopId: String, lat: Double, lng: Double, akurasiM: Float?): HasilTiba {
            tibaGagal?.let { throw RuntimeException(it) }
            return hasilTiba
        }
        override suspend fun kirimLokasi(titik: List<Titik>) = HasilKirim("berjalan", Pengaturan(), titik.size)
        override suspend fun selesaikan(perjalananId: String): RingkasanPerjalanan {
            selesaiDipanggil++
            return RingkasanPerjalanan(12.3, 3600)
        }
        override suspend fun perjalananAktif(): PerjalananUi? {
            if (aktifGagalSekali) {
                aktifGagalSekali = false
                throw java.io.IOException("sinyal putus")
            }
            return aktif
        }
    }

    private class ServicePalsu : KendaliService {
        var mulai = 0
        var hentikan = 0
        override fun mulai(pengaturan: Pengaturan, tiba: Int, total: Int) { mulai++ }
        override fun perbarui(tiba: Int, total: Int) {}
        override fun hentikan() { hentikan++ }
    }

    private val lokasi = object : SumberLokasi {
        override suspend fun posisi() = Posisi(-6.60, 106.80, 5f)
    }

    private fun vm(api: ApiPalsu, svc: ServicePalsu = ServicePalsu(), izin: Boolean = true) =
        PengantaranViewModel(api, lokasi, svc) { izin }

    @Test
    fun bukaUlangSaatPerjalananBerjalanMenyalakanService() = runTest {
        val api = ApiPalsu().apply { aktif = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), listOf(stop("1", 1, "tiba"), stop("2", 2))) }
        val svc = ServicePalsu()
        val v = vm(api, svc)
        v.muat()
        assertEquals(LayarPengantaran.DalamPerjalanan, v.state.value.layar)
        assertEquals(1, svc.mulai)
    }

    @Test
    fun tanpaPerjalananTampilPilihMuatan() = runTest {
        val v = vm(ApiPalsu())
        v.muat()
        assertEquals(LayarPengantaran.PilihMuatan, v.state.value.layar)
        assertEquals(2, v.state.value.sjSiap.size)
    }

    @Test
    fun izinBelumAdaKePerluIzin() = runTest {
        val v = vm(ApiPalsu(), izin = false)
        v.muat()
        assertEquals(LayarPengantaran.PerluIzin, v.state.value.layar)
    }

    @Test
    fun lanjutTanpaPilihanDitahan() = runTest {
        val v = vm(ApiPalsu())
        v.muat()
        v.lanjutUrutan()
        assertEquals(LayarPengantaran.PilihMuatan, v.state.value.layar)
        assertEquals("Pilih minimal satu surat jalan", v.state.value.pesan)
    }

    @Test
    fun berangkatMemakaiUrutanLayar() = runTest {
        val api = ApiPalsu()
        val svc = ServicePalsu()
        val v = vm(api, svc)
        v.muat()
        v.pilih("b"); v.pilih("a")
        v.lanjutUrutan()
        assertEquals(listOf("a", "b"), v.state.value.urutan.map { it.suratJalanId }) // usulan terdekat
        v.pindah(1, 0)
        v.berangkat()
        assertEquals(listOf("b", "a"), api.mulaiDipanggil)
        assertEquals(LayarPengantaran.DalamPerjalanan, v.state.value.layar)
        assertEquals(1, svc.mulai)
    }

    @Test
    fun sjGandaTetapDiUrutanDenganPesan() = runTest {
        val api = ApiPalsu().apply { mulaiGagal = "Surat jalan SJ-A sudah dibawa perjalanan lain" }
        val v = vm(api)
        v.muat(); v.pilih("a"); v.lanjutUrutan()
        api.siap = api.siap.filter { it.suratJalanId != "a" }
        v.berangkat()
        assertEquals(LayarPengantaran.SusunUrutan, v.state.value.layar)
        assertTrue(v.state.value.pesan!!.contains("SJ-A"))
        assertEquals(emptyList<String>(), v.state.value.urutan.map { it.suratJalanId })
    }

    @Test
    fun tibaTerakhirMenutupKeRingkasan() = runTest {
        val api = ApiPalsu().apply {
            aktif = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), listOf(stop("1", 1)))
            hasilTiba = HasilTiba(20.0, "selesai")
        }
        val svc = ServicePalsu()
        val v = vm(api, svc)
        v.muat()
        api.aktif = null
        v.tiba("1")
        assertEquals(LayarPengantaran.Ringkasan, v.state.value.layar)
        assertEquals(1, svc.hentikan)
    }

    @Test
    fun selesaikanDenganStopMenungguButuhKonfirmasi() = runTest {
        val api = ApiPalsu().apply { aktif = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), listOf(stop("1", 1))) }
        val v = vm(api)
        v.muat()
        v.mintaSelesaikan()
        assertTrue(v.state.value.konfirmasiSelesai)
        assertEquals(0, api.selesaiDipanggil)
        v.selesaikan()
        assertEquals(1, api.selesaiDipanggil)
        assertFalse(v.state.value.konfirmasiSelesai)
        assertEquals(LayarPengantaran.Ringkasan, v.state.value.layar)
        assertEquals(12.3, v.state.value.ringkasan!!.totalKm!!, 0.001)
    }

    @Test
    fun galatTibaMemuatUlangLayar() = runTest {
        val api = ApiPalsu().apply { aktif = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), listOf(stop("1", 1), stop("2", 2))) }
        val v = vm(api)
        v.muat()
        // Outlet sudah memverifikasi stop 1 di server; driver menekan Tiba.
        api.aktif = api.aktif!!.copy(stops = listOf(stop("1", 1, "tiba"), stop("2", 2)))
        api.tibaGagal = "Surat jalan ini sudah tiba (verifikasi outlet)"
        v.tiba("1")
        assertEquals("tiba", v.state.value.perjalanan!!.stops.first { it.id == "1" }.status)
        assertTrue(v.state.value.pesan!!.contains("verifikasi outlet"))
    }

    @Test
    fun berangkatSuksesTapiMuatGagalTetapMasukPerjalanan() = runTest {
        val api = ApiPalsu()
        val svc = ServicePalsu()
        val v = vm(api, svc)
        v.muat(); v.pilih("a"); v.lanjutUrutan()
        api.aktifGagalSekali = true
        v.berangkat()
        assertEquals(LayarPengantaran.DalamPerjalanan, v.state.value.layar)
        assertEquals(1, svc.mulai)
    }
}

class PemulihanPengantaranTest {
    @Test
    fun driverDenganPerjalananBerjalanDibukaOtomatis() = runTest {
        val berjalan = PerjalananUi("p1", "2026-10-27T02:40:00Z", Pengaturan(), emptyList())
        assertTrue(PemulihanPengantaran.perluDibuka("driver") { berjalan })
        assertFalse(PemulihanPengantaran.perluDibuka("driver") { null })
        assertFalse(PemulihanPengantaran.perluDibuka("kitchen") { berjalan })
        assertFalse(PemulihanPengantaran.perluDibuka("driver") { throw java.io.IOException("offline") })
    }
}
