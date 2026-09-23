package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private fun outlet(
    id: String,
    nama: String,
    lat: Double? = null,
    lng: Double? = null,
    aktif: Boolean = true
) = OutletDto(id = id, name = nama, address = null, lat = lat, lng = lng, isActive = aktif)

// Koordinat nyata dua kota yang jaraknya diketahui, bukan angka karangan.
private val BOGOR = Koordinat(-6.5971, 106.8060)
private val DEPOK = Koordinat(-6.4025, 106.7942)

class JarakOutletTest {

    @Test
    fun `jarak Bogor ke Depok sekitar 21 km`() {
        val meter = jarakMeter(BOGOR, DEPOK)
        assertEquals(21_600.0, meter, 500.0)
    }

    @Test
    fun `jarak titik ke dirinya sendiri nol`() {
        assertEquals(0.0, jarakMeter(BOGOR, BOGOR), 0.001)
    }

    @Test
    fun `outlet tanpa koordinat tidak punya jarak`() {
        assertNull(jarakOutlet(outlet("a", "A"), BOGOR))
        assertNull(jarakOutlet(outlet("a", "A", lat = -6.5, lng = null), BOGOR))
    }

    @Test
    fun `dengan posisi, outlet terdekat di atas`() {
        val hasil = urutkanOutlet(
            listOf(
                outlet("depok", "Aaa Depok", DEPOK.lat, DEPOK.lng),
                outlet("bogor", "Zzz Bogor", BOGOR.lat, BOGOR.lng),
            ),
            posisi = BOGOR
        )
        assertEquals(listOf("bogor", "depok"), hasil.map { it.id })
    }

    @Test
    fun `dengan posisi, outlet tanpa koordinat di bawah dan alfabetis`() {
        val hasil = urutkanOutlet(
            listOf(
                outlet("z", "Zeta"),
                outlet("a", "Alfa"),
                outlet("depok", "Depok", DEPOK.lat, DEPOK.lng),
            ),
            posisi = BOGOR
        )
        assertEquals(listOf("depok", "a", "z"), hasil.map { it.id })
    }

    @Test
    fun `dengan posisi, outlet buka tetap di atas yang belum buka`() {
        val hasil = urutkanOutlet(
            listOf(
                outlet("tutup-dekat", "Dekat", BOGOR.lat, BOGOR.lng, aktif = false),
                outlet("buka-jauh", "Jauh", DEPOK.lat, DEPOK.lng),
            ),
            posisi = BOGOR
        )
        assertEquals(listOf("buka-jauh", "tutup-dekat"), hasil.map { it.id })
    }

    @Test
    fun `tanpa posisi, urutan tetap alfabetis`() {
        val hasil = urutkanOutlet(
            listOf(
                outlet("z", "Zeta", BOGOR.lat, BOGOR.lng),
                outlet("a", "Alfa", DEPOK.lat, DEPOK.lng),
            ),
            posisi = null
        )
        assertEquals(listOf("a", "z"), hasil.map { it.id })
    }

    @Test
    fun `label jarak di bawah satu kilometer dalam meter dibulatkan puluhan`() {
        assertEquals("850 m", labelJarak(847.0))
        assertEquals("10 m", labelJarak(3.0))
    }

    @Test
    fun `label jarak kilometer memakai koma desimal`() {
        assertEquals("1,2 km", labelJarak(1_234.0))
        assertEquals("21,6 km", labelJarak(21_580.0))
    }

    @Test
    fun `label jarak jauh tanpa desimal`() {
        assertEquals("125 km", labelJarak(124_600.0))
    }

    @Test
    fun `pembulatan ke atas 1000 m jadi kilometer`() {
        assertEquals("1,0 km", labelJarak(996.0))
    }
}
