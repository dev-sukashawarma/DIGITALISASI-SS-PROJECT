package com.sukashawarma.customer

import android.app.Application

/**
 * Titik hidup tingkat proses aplikasi.
 *
 * `AppContainer` WAJIB hidup di sini — bukan di `MainActivity.onCreate()` —
 * agar perubahan konfigurasi (mode gelap, ukuran font, "Don't keep activities")
 * tidak menciptakan dua instans `CartStore`/`NotificationStore` yang saling
 * menyimpang atau membocorkan `HttpClient` Ktor baru di setiap recreate.
 */
class SukaCustomerApp : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}
