package com.sukashawarma.customer.ui.home

import android.Manifest
import android.app.Application
import android.content.Context
import android.location.Location
import android.location.LocationManager
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class LokasiPelangganTest {

    @Test
    fun `lokasi cache dari network tetap dipakai walau hanya punya ACCESS_COARSE_LOCATION`() = runTest {
        val app = ApplicationProvider.getApplicationContext<Application>()
        Shadows.shadowOf(app).grantPermissions(Manifest.permission.ACCESS_COARSE_LOCATION)

        val lm = app.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val shadowLm = Shadows.shadowOf(lm)
        shadowLm.setProviderEnabled(LocationManager.NETWORK_PROVIDER, true)
        shadowLm.setProviderEnabled(LocationManager.GPS_PROVIDER, true)

        val loc = Location(LocationManager.NETWORK_PROVIDER).apply {
            latitude = -6.5971
            longitude = 106.8060
            time = System.currentTimeMillis()
        }
        shadowLm.setLastKnownLocation(LocationManager.NETWORK_PROVIDER, loc)

        val hasil = LokasiPelanggan(app).ambil()
        assertTrue(hasil is HasilLokasi.Ada)
        val koordinat = (hasil as HasilLokasi.Ada).koordinat
        assertEquals(-6.5971, koordinat.lat, 0.0001)
        assertEquals(106.8060, koordinat.lng, 0.0001)
    }
}
