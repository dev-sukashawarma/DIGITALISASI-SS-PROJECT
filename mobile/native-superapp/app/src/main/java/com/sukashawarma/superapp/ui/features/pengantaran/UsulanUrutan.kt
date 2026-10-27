package com.sukashawarma.superapp.ui.features.pengantaran

/**
 * Usulan urutan antar: tetangga terdekat berantai dari posisi driver saat ini
 * (Gudang Pusat belum punya koordinat). SJ ke outlet yang sama dikelompokkan
 * berdampingan; outlet tanpa koordinat ditaruh di akhir dengan urutan asli.
 * Driver tetap bisa mengubah urutan sesudahnya.
 */
object UsulanUrutan {
    fun susun(mulaiLat: Double, mulaiLng: Double, sj: List<SjSiap>): List<SjSiap> {
        val grup = LinkedHashMap<String, MutableList<SjSiap>>()
        for (s in sj) grup.getOrPut(s.outletId) { mutableListOf() }.add(s)

        val berKoordinat = grup.values.filter { it.first().lat != null && it.first().lng != null }.toMutableList()
        val tanpaKoordinat = grup.values.filter { it.first().lat == null || it.first().lng == null }

        val hasil = mutableListOf<SjSiap>()
        var lat = mulaiLat
        var lng = mulaiLng
        while (berKoordinat.isNotEmpty()) {
            val terdekat = berKoordinat.minByOrNull { jarakMeter(lat, lng, it.first().lat!!, it.first().lng!!) }!!
            berKoordinat.remove(terdekat)
            hasil += terdekat
            lat = terdekat.first().lat!!
            lng = terdekat.first().lng!!
        }
        tanpaKoordinat.forEach { hasil += it }
        return hasil
    }
}
