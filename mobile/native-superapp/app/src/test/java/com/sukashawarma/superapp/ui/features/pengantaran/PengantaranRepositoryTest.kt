package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PengantaranRepositoryTest {

    private val dipanggil = mutableListOf<Pair<String, JsonObject>>()
    private fun repo(balasan: String) = PengantaranRepository { nama, param ->
        dipanggil += nama to param
        balasan
    }

    @Test
    fun kirimLokasiMengirimIsoUtcDanMembacaStatus() = runTest {
        val r = repo("""{"diterima": 2, "pengaturan": {"jarak_min_m": 80, "retensi_hari": 60, "interval_detik": 45, "batas_tutup_wib": "21:00"}, "status_perjalanan": "ditutup_otomatis"}""")
        val hasil = r.kirimLokasi(listOf(
            Titik(lat = -6.6, lng = 106.8, akurasiM = 5f, bateraiPersen = 80, waktuMs = 1_792_206_720_000),
        ))
        assertEquals(HasilKirim("ditutup_otomatis", Pengaturan(intervalDetik = 45, jarakMinM = 80, batasTutupWib = "21:00"), 2), hasil)
        val (nama, param) = dipanggil.single()
        assertEquals("driver_kirim_lokasi", nama)
        val t = param["p_titik"]!!.jsonArray[0].jsonObject
        assertEquals("2026-10-17T03:12:00.000Z", t["direkam_at"]!!.jsonPrimitive.content)
        assertEquals("80", t["baterai_persen"]!!.jsonPrimitive.content)
    }

    @Test
    fun perjalananAktifNullDanBerisi() = runTest {
        assertNull(repo("null").perjalananAktif())
        val p = repo(
            """{"stops": [{"id": "s1", "lat": -6.4, "lng": 106.8, "status": "tiba", "urutan": 1, "tiba_at": "2026-10-27T03:12:00+00:00",
               "outlet_id": "o1", "outlet_name": "MITRA CIBINONG", "tiba_sumber": "driver", "tiba_jarak_m": null,
               "surat_jalan_id": "sj1", "document_number": "SJ-001"}],
               "pengaturan": {"interval_detik": 30, "jarak_min_m": 100, "batas_tutup_wib": "21:00"},
               "perjalanan": {"id": "p1", "status": "berjalan", "berangkat_at": "2026-10-27T02:40:00+00:00"}}"""
        ).perjalananAktif()!!
        assertEquals("p1", p.id)
        assertEquals(1, p.stops.size)
        assertEquals("MITRA CIBINONG", p.stops[0].outletName)
        assertNull(p.stops[0].tibaJarakM)
    }

    @Test
    fun sjSiapDanMulai() = runTest {
        val daftar = repo("""[{"surat_jalan_id": "sj1", "document_number": "SJ-1", "outlet_id": "o1", "outlet_name": "A", "lat": null, "lng": 106.8, "jumlah_item": 4, "created_at": "2026-10-27T01:00:00+00:00"}]""").sjSiap()
        assertEquals(SjSiap("sj1", "SJ-1", "o1", "A", null, 106.8, 4), daftar.single())

        val (id, peng) = repo("""{"perjalanan_id": "p9", "pengaturan": {"interval_detik": 30, "jarak_min_m": 100, "batas_tutup_wib": "21:00"}}""")
            .mulai(listOf("sj1", "sj2"), -6.6, 106.8)
        assertEquals("p9", id)
        assertEquals(Pengaturan(), peng)
        assertEquals(listOf("sj1", "sj2"), dipanggil.last().second["p_sj_ids"]!!.jsonArray.map { it.jsonPrimitive.content })
    }

    @Test
    fun tibaJarakNullUntukOutletTanpaKoordinat() = runTest {
        assertNull(repo("""{"tiba_jarak_m": null, "perjalanan_status": "berjalan"}""").tandaiTiba("s1", -6.6, 106.8, 5f).jarakM)
        assertEquals("selesai", repo("""{"tiba_jarak_m": 31.2, "perjalanan_status": "selesai"}""").tandaiTiba("s1", -6.6, 106.8, 5f).statusPerjalanan)
    }
}
