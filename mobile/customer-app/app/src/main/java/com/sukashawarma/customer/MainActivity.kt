package com.sukashawarma.customer

import android.os.Bundle
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.sukashawarma.customer.navigation.CustomerAppRoot
import com.sukashawarma.customer.ui.theme.SukaTheme

/** Lama splash ditahan sejak Activity dibuat. */
const val DURASI_SPLASH_MS = 3_000L

/**
 * Apakah splash masih boleh menutupi layar.
 *
 * Dipisah sebagai fungsi murni supaya bisa diuji tanpa menjalankan Android:
 * ia memakai waktu yang diberikan, bukan jam sistem.
 */
fun splashMasihTampil(
    mulaiMs: Long,
    sekarangMs: Long,
    durasiMs: Long = DURASI_SPLASH_MS,
): Boolean = sekarangMs - mulaiMs < durasiMs

/**
 * Titik masuk utama aplikasi Android pelanggan SukaShawarma.
 *
 * Aplikasi ini HANYA berbicara ke Retail Gateway lewat HTTP.
 * Tidak ada SDK Supabase, anon key, service role, atau URL database di sini.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // WAJIB dipanggil SEBELUM super.onCreate(), sesuai kontrak
        // androidx.core.splashscreen. Dipanggil setelahnya, splash tak muncul.
        val splash = installSplashScreen()

        // SystemClock.elapsedRealtime(), bukan System.currentTimeMillis():
        // jam dinding bisa melompat (sinkronisasi NTP, zona waktu) dan lompatan
        // mundur akan membuat splash menggantung jauh lebih lama dari 3 detik.
        val mulai = SystemClock.elapsedRealtime()
        splash.setKeepOnScreenCondition {
            splashMasihTampil(mulai, SystemClock.elapsedRealtime())
        }

        super.onCreate(savedInstanceState)
        val container = AppContainer(applicationContext)

        setContent {
            SukaTheme {
                CustomerAppRoot(container)
            }
        }
    }
}
