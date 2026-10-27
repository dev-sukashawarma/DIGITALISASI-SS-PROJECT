package com.sukashawarma.superapp.ui.features.pengantaran

import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Satu titik GPS. Waktu disimpan sebagai epoch milidetik (minSdk 24, tanpa
 * desugaring java.time) dan baru diubah ke ISO-8601 UTC saat dikirim ke RPC
 * driver_kirim_lokasi.
 */
@Serializable
data class Titik(
    val lat: Double,
    val lng: Double,
    val akurasiM: Float? = null,
    val kecepatanMps: Float? = null,
    val arahDerajat: Float? = null,
    val bateraiPersen: Int? = null,
    val waktuMs: Long,
)

/** Pengaturan dari global_settings.driver_tracking (dikirim balik oleh RPC). */
data class Pengaturan(
    val intervalDetik: Int = 30,
    val jarakMinM: Int = 100,
    val batasTutupWib: String = "21:00",
)

data class SjSiap(
    val suratJalanId: String,
    val documentNumber: String?,
    val outletId: String,
    val outletName: String,
    val lat: Double?,
    val lng: Double?,
    val jumlahItem: Int,
)

data class StopUi(
    val id: String,
    val suratJalanId: String,
    val documentNumber: String?,
    val outletName: String,
    val urutan: Int,
    val status: String,
    val tibaAtIso: String?,
    val tibaSumber: String?,
    val tibaJarakM: Double?,
)

data class PerjalananUi(
    val id: String,
    val berangkatAtIso: String,
    val pengaturan: Pengaturan,
    val stops: List<StopUi>,
)

data class HasilKirim(val statusPerjalanan: String, val pengaturan: Pengaturan, val diterima: Int)

data class RingkasanPerjalanan(val totalKm: Double?, val durasiDetik: Int?)

private val isoUtc = ThreadLocal.withInitial {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
}

/** Epoch ms → "2026-10-27T03:12:00.000Z". */
fun keIsoUtc(waktuMs: Long): String = isoUtc.get()!!.format(Date(waktuMs))

/** Jarak haversine dalam meter. */
fun jarakMeter(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val r = 6_371_000.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val h = Math.sin(dLat / 2).let { it * it } +
        Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2).let { it * it }
    return 2 * r * Math.asin(Math.sqrt(h))
}
