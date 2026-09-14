package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.sukashawarma.customer.data.perbaruiSplash
import com.sukashawarma.customer.navigation.CustomerAppRoot
import com.sukashawarma.customer.ui.home.SplashAplikasiScreen
import com.sukashawarma.customer.ui.theme.SukaTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Titik masuk utama aplikasi Android pelanggan SukaShawarma.
 *
 * Aplikasi ini HANYA berbicara ke Retail Gateway lewat HTTP.
 * Tidak ada SDK Supabase, anon key, service role, atau URL database di sini.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // WAJIB sebelum super.onCreate(), sesuai kontrak androidx.core.splashscreen.
        // Splash sistem TIDAK lagi ditahan: ia hilang di frame pertama, lalu
        // SplashAplikasiScreen (gambar dari admin) yang memegang durasi.
        val splashSistem = installSplashScreen()

        // Sinyal splash sistem sudah hilang: hitungan durasi splash aplikasi
        // baru dimulai sesudahnya. Saat Activity dibuat ulang (memutar layar)
        // splash sistem tak tampil lagi, jadi langsung dianggap hilang.
        val splashSistemHilang = mutableStateOf(savedInstanceState != null)
        splashSistem.setOnExitAnimationListener { penyedia ->
            // Wajib dipanggil bila listener dipasang; tanpa ini splash sistem
            // tak pernah dilepas dari layar.
            penyedia.remove()
            splashSistemHilang.value = true
        }

        super.onCreate(savedInstanceState)
        val container = AppContainer(applicationContext)

        // Di balik layar, untuk pembukaan berikutnya. Tak pernah menahan splash.
        lifecycleScope.launch(Dispatchers.IO) {
            runCatching { perbaruiSplash(container.repository, container.splashStore) }
        }

        setContent {
            SukaTheme {
                // rememberSaveable: memutar layar tidak mengulang splash.
                var splashSelesai by rememberSaveable { mutableStateOf(false) }
                // Dibaca sekali, sebelum pembaruan di atas sempat menulis apa pun.
                val gambar = remember { container.splashStore.berkasGambar() }
                val durasi = remember { container.splashStore.durasiMs() }

                Box(modifier = Modifier.fillMaxSize()) {
                    CustomerAppRoot(container)
                    if (!splashSelesai) {
                        // Tombol kembali selama splash tidak boleh menggerakkan
                        // navigasi yang tersembunyi di bawahnya.
                        BackHandler {}
                        SplashAplikasiScreen(
                            berkasGambar = gambar,
                            durasiMs = durasi,
                            splashSistemHilang = splashSistemHilang.value,
                            onSelesai = { splashSelesai = true },
                        )
                    }
                }
            }
        }
    }
}
