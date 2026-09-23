package com.sukashawarma.customer.ui.home

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

sealed interface HasilLokasi {
    data class Ada(val koordinat: Koordinat) : HasilLokasi
    /** Pelanggan belum/tidak mengizinkan lokasi. */
    data object TanpaIzin : HasilLokasi
    /** Izin ada, tapi lokasi mati / tak kunjung didapat. */
    data object TidakTersedia : HasilLokasi
}

/**
 * Lokasi kasar pelanggan, HANYA untuk mengurutkan outlet terdekat.
 *
 * Cukup `ACCESS_COARSE_LOCATION` (~ratusan meter): untuk memilih outlet itu
 * sudah memadai, dan pelanggan lebih rela mengizinkannya daripada GPS presisi.
 * Memakai `LocationManager` bawaan Android -- tanpa pustaka Play Services.
 *
 * Tidak pernah disimpan dan tidak pernah dikirim ke gateway.
 */
class LokasiPelanggan(context: Context) {

    private val appContext = context.applicationContext
    private val lm = appContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    fun punyaIzin(): Boolean =
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission") // dicek lewat punyaIzin(); SecurityException tetap ditangkap
    suspend fun ambil(): HasilLokasi {
        if (!punyaIzin()) return HasilLokasi.TanpaIzin

        val provider = pilihProvider() ?: return HasilLokasi.TidakTersedia

        val terakhir = lokasiTerakhir()
        if (terakhir != null && umurMs(terakhir) < SEGAR_MS) return HasilLokasi.Ada(terakhir.keKoordinat())

        val baru = withTimeoutOrNull(BATAS_TUNGGU_MS) { lokasiSekarang(provider) }
        val hasil = baru ?: terakhir // lokasi lama lebih baik daripada tidak ada, untuk mengurutkan
        return hasil?.let { HasilLokasi.Ada(it.keKoordinat()) } ?: HasilLokasi.TidakTersedia
    }

    private fun pilihProvider(): String? {
        val aktif = try {
            lm.getProviders(true)
        } catch (_: SecurityException) {
            return null
        }
        val urutan = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(LocationManager.FUSED_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
            add(LocationManager.GPS_PROVIDER)
        }
        return urutan.firstOrNull { it in aktif }
    }

    @SuppressLint("MissingPermission")
    private fun lokasiTerakhir(): Location? = try {
        lm.getProviders(true)
            .mapNotNull { lm.getLastKnownLocation(it) }
            .maxByOrNull { it.time }
    } catch (_: SecurityException) {
        null
    }

    @SuppressLint("MissingPermission")
    private suspend fun lokasiSekarang(provider: String): Location? =
        suspendCancellableCoroutine { lanjut ->
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val batal = CancellationSignal()
                    lanjut.invokeOnCancellation { batal.cancel() }
                    lm.getCurrentLocation(provider, batal, ContextCompat.getMainExecutor(appContext)) {
                        if (lanjut.isActive) lanjut.resume(it)
                    }
                } else {
                    val pendengar = object : LocationListener {
                        override fun onLocationChanged(location: Location) {
                            if (lanjut.isActive) lanjut.resume(location)
                        }
                        @Deprecated("Diperlukan untuk API < 29")
                        override fun onStatusChanged(p: String?, s: Int, e: android.os.Bundle?) = Unit
                        override fun onProviderEnabled(p: String) = Unit
                        override fun onProviderDisabled(p: String) {
                            if (lanjut.isActive) lanjut.resume(null)
                        }
                    }
                    lanjut.invokeOnCancellation { lm.removeUpdates(pendengar) }
                    @Suppress("DEPRECATION")
                    lm.requestSingleUpdate(provider, pendengar, Looper.getMainLooper())
                }
            } catch (_: SecurityException) {
                if (lanjut.isActive) lanjut.resume(null)
            } catch (_: IllegalArgumentException) {
                if (lanjut.isActive) lanjut.resume(null)
            }
        }

    private fun umurMs(l: Location) = System.currentTimeMillis() - l.time

    private fun Location.keKoordinat() = Koordinat(latitude, longitude)

    private companion object {
        // Longgar dengan sengaja: untuk mengurutkan outlet se-kota, lokasi 30
        // menit lalu hampir selalu cukup, dan memakainya langsung menghindari
        // 5-10 dtk menunggu -- selama itu daftar A-Z bisa berubah urutan
        // tepat di bawah jari pelanggan.
        const val SEGAR_MS = 30 * 60 * 1000L
        const val BATAS_TUNGGU_MS = 10_000L
    }
}
