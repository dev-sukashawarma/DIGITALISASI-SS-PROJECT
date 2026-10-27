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

/** ISO-8601 dari Postgres ("2026-10-27T02:40:00.123+00:00" / "...Z") → "HH:mm" WIB. */
fun jamWib(iso: String): String {
    val utama = iso.substring(0, 19)
    val ekor = iso.substring(19).dropWhile { it == '.' || it.isDigit() }
    val zona = when {
        ekor.isEmpty() || ekor == "Z" -> "UTC"
        else -> "GMT$ekor"
    }
    val masuk = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone(zona) }
    val keluar = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = TimeZone.getTimeZone("Asia/Jakarta") }
    return keluar.format(masuk.parse(utama)!!)
}

/** Sama dengan formatJarak di web distribusi: "35 m" / "4,2 km". */
fun formatJarak(meter: Double): String =
    if (meter < 1000) "${Math.round(meter)} m"
    else String.format(Locale.US, "%.1f km", meter / 1000).replace('.', ',')
