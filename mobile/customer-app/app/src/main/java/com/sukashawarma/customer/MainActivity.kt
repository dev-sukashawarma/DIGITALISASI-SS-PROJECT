package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sukashawarma.customer.ui.screens.catalog.CatalogScreen
import com.sukashawarma.customer.ui.screens.catalog.CatalogViewModel
import com.sukashawarma.customer.ui.screens.outlet.OutletPickerScreen
import com.sukashawarma.customer.ui.screens.outlet.OutletPickerViewModel
import com.sukashawarma.customer.ui.theme.SukaTheme

/**
 * Aplikasi ini HANYA berbicara ke Retail Gateway lewat HTTP.
 * Tidak ada SDK Supabase, anon key, service role, atau URL database di sini.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = AppContainer(applicationContext)

        setContent {
            SukaTheme {
                CustomerAppRoot(container)
            }
        }
    }
}

private object Rute {
    const val KATALOG = "katalog"
    const val PILIH_OUTLET = "pilih-outlet"
}

/**
 * `CatalogViewModel` dibuat di tingkat NavHost, BUKAN di dalam `composable`,
 * supaya outlet dan katalog yang sudah dimuat tidak hilang setiap kali
 * pelanggan bolak-balik ke layar pilih outlet.
 */
@Composable
fun CustomerAppRoot(container: AppContainer) {
    val navController = rememberNavController()

    val catalogViewModel: CatalogViewModel = viewModel(
        factory = pabrik { CatalogViewModel(container.repository, container.outletStore) }
    )

    NavHost(navController = navController, startDestination = Rute.KATALOG) {
        composable(Rute.KATALOG) {
            CatalogScreen(
                viewModel = catalogViewModel,
                onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                // Detail item dan keranjang menyusul di Task 7. Sampai saat itu
                // ketukan tidak melakukan apa-apa -- disengaja dan tercatat,
                // bukan penanganan yang kelupaan.
                onPilihItem = {}
            )
        }

        composable(Rute.PILIH_OUTLET) {
            val outletViewModel: OutletPickerViewModel = viewModel(
                factory = pabrik { OutletPickerViewModel(container.repository) }
            )
            OutletPickerScreen(
                viewModel = outletViewModel,
                onPilih = { outlet ->
                    catalogViewModel.pilihOutlet(outlet)
                    navController.popBackStack()
                }
            )
        }
    }
}

/** Pabrik ViewModel sederhana untuk dependensi yang dirakit tangan. */
private fun <T : ViewModel> pabrik(buat: () -> T): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = buat() as VM
    }
