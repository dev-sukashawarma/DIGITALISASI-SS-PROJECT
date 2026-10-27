package com.sukashawarma.superapp.ui.features.pengantaran

/**
 * Menentukan titik GPS mana yang dikirim: tiap `intervalDetik` ATAU setiap
 * pindah ≥ `jarakMinM`, mana yang lebih dulu. Driver yang praktis diam
 * (< 15 m dan belum lewat interval) tidak menghasilkan titik baru.
 */
class FilterTitik(var pengaturan: Pengaturan) {
    fun perluKirim(baru: Titik, terakhir: Titik?): Boolean {
        if (terakhir == null) return true
        val detik = (baru.waktuMs - terakhir.waktuMs) / 1000
        if (detik >= pengaturan.intervalDetik) return true
        val meter = jarakMeter(terakhir.lat, terakhir.lng, baru.lat, baru.lng)
        if (meter < AMBANG_DIAM_M) return false
        return meter >= pengaturan.jarakMinM
    }

    companion object {
        const val AMBANG_DIAM_M = 15.0
    }
}
