package com.sukashawarma.customer.ui.home

import com.sukashawarma.customer.data.api.OutletDto
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

/** Posisi di bumi, derajat desimal. */
data class Koordinat(val lat: Double, val lng: Double)

private const val JARI_JARI_BUMI_M = 6_371_000.0

/**
 * Jarak garis lurus (haversine), BUKAN jarak jalan. Cukup untuk mengurutkan
 * outlet terdekat; jangan dipakai untuk menjanjikan waktu tempuh.
 */
fun jarakMeter(a: Koordinat, b: Koordinat): Double {
    val dLat = Math.toRadians(b.lat - a.lat)
    val dLng = Math.toRadians(b.lng - a.lng)
    val h = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(a.lat)) * cos(Math.toRadians(b.lat)) * sin(dLng / 2) * sin(dLng / 2)
    return 2 * JARI_JARI_BUMI_M * asin(sqrt(h.coerceIn(0.0, 1.0)))
}

/** `null` kalau outlet tak punya koordinat lengkap -- bukan 0, bukan tebakan. */
fun jarakOutlet(outlet: OutletDto, posisi: Koordinat): Double? {
    val lat = outlet.lat ?: return null
    val lng = outlet.lng ?: return null
    return jarakMeter(posisi, Koordinat(lat, lng))
}

/**
 * Mengurutkan outlet: yang buka di atas, lalu
 *  - dengan [posisi]: terdekat dulu; outlet tanpa koordinat di bawah, alfabetis.
 *  - tanpa posisi (izin ditolak / GPS mati): alfabetis.
 */
fun urutkanOutlet(outlets: List<OutletDto>, posisi: Koordinat? = null): List<OutletDto> {
    val bukaDulu = compareByDescending<OutletDto> { it.isActive }
    val pembanding = if (posisi == null) {
        bukaDulu
    } else {
        bukaDulu
            .thenBy { jarakOutlet(it, posisi) == null }
            .thenBy { jarakOutlet(it, posisi) ?: 0.0 }
    }
    return outlets.sortedWith(pembanding.thenBy { it.name.lowercase() })
}

/** "850 m" di bawah 1 km (puluhan meter), "1,2 km", lalu "125 km" dari 100 km. */
fun labelJarak(meter: Double): String {
    val puluhan = (meter / 10).roundToLong() * 10
    if (puluhan < 1_000) return "${puluhan.coerceAtLeast(10)} m"
    val km = meter / 1_000
    if (km >= 100) return "${km.roundToLong()} km"
    val sepersepuluh = (km * 10).roundToLong()
    return "${sepersepuluh / 10},${sepersepuluh % 10} km"
}
