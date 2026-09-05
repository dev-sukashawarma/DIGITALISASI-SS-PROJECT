package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.screens.cart.CartScreen
import com.sukashawarma.customer.ui.screens.cart.CartViewModel
import com.sukashawarma.customer.ui.screens.catalog.CatalogScreen
import com.sukashawarma.customer.ui.screens.catalog.CatalogViewModel
import com.sukashawarma.customer.ui.screens.detail.ItemDetailScreen
import com.sukashawarma.customer.ui.screens.detail.ItemDetailViewModel
import com.sukashawarma.customer.ui.screens.outlet.OutletPickerScreen
import com.sukashawarma.customer.ui.screens.outlet.OutletPickerViewModel
import com.sukashawarma.customer.ui.theme.SukaTheme
import kotlin.math.roundToLong

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
    const val KERANJANG = "keranjang"
    const val DETAIL = "detail/{menuItemId}"
    fun detail(menuItemId: String) = "detail/$menuItemId"
}

/**
 * `CatalogViewModel` dan `CartViewModel` dibuat di tingkat NavHost, BUKAN di
 * dalam masing-masing `composable`. Katalog yang sudah dimuat tidak hilang
 * saat pelanggan bolak-balik, dan keranjang punya SATU sumber kebenaran di
 * seluruh layar -- dua salinan keranjang akan saling menyimpang.
 */
@Composable
fun CustomerAppRoot(container: AppContainer) {
    val navController = rememberNavController()

    val catalogViewModel: CatalogViewModel = viewModel(
        factory = pabrik {
            CatalogViewModel(container.repository, container.outletStore, container.cartStore)
        }
    )
    val cartViewModel: CartViewModel = viewModel(
        factory = pabrik { CartViewModel(container.cartStore) }
    )

    val catalogState by catalogViewModel.state.collectAsStateWithLifecycle()
    val cartState by cartViewModel.state.collectAsStateWithLifecycle()

    NavHost(navController = navController, startDestination = Rute.KATALOG) {
        composable(Rute.KATALOG) {
            CatalogScreen(
                viewModel = catalogViewModel,
                porsiKeranjang = cartState.porsi,
                subtotalKeranjang = cartState.subtotal,
                onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                onPilihItem = { navController.navigate(Rute.detail(it.id)) },
                onBukaKeranjang = { navController.navigate(Rute.KERANJANG) }
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
                    // Berpindah outlet bisa mengosongkan keranjang. Tampilan
                    // keranjang harus ikut menyusul, kalau tidak bilah bawah
                    // masih memamerkan isi yang sudah tidak ada.
                    cartViewModel.segarkan()
                    navController.popBackStack()
                }
            )
        }

        composable(
            Rute.DETAIL,
            arguments = listOf(navArgument("menuItemId") { type = NavType.StringType })
        ) { entri ->
            val menuItemId = entri.arguments?.getString("menuItemId")
            val item = catalogState.semuaItem.firstOrNull { it.id == menuItemId }

            // Item bisa hilang kalau katalog dimuat ulang selagi layar detail
            // terbuka. Layar kosong yang menjelaskan dirinya lebih baik
            // daripada crash atau layar putih tanpa keterangan.
            if (item == null) {
                EmptyState(
                    judul = "Menu tidak ditemukan",
                    penjelasan = "Menu ini sudah tidak ada di katalog outlet."
                )
                return@composable
            }

            val detailViewModel: ItemDetailViewModel = viewModel(
                factory = pabrik { ItemDetailViewModel() }
            )
            ItemDetailScreen(
                item = item,
                viewModel = detailViewModel,
                onKembali = { navController.popBackStack() },
                onTambahKeKeranjang = { jumlah, catatan ->
                    cartViewModel.tambah(
                        menuItemId = item.id,
                        nama = item.name,
                        // Rupiah tidak punya satuan pecahan. Pembulatan
                        // dilakukan SEKALI di sini; gateway membandingkan
                        // `unit_price` dengan katalog memakai kesamaan persis.
                        hargaSatuan = item.price.roundToLong(),
                        jumlah = jumlah,
                        catatan = catatan
                    )
                    navController.popBackStack()
                }
            )
        }

        composable(Rute.KERANJANG) {
            CartScreen(
                viewModel = cartViewModel,
                onKembali = { navController.popBackStack() },
                // Checkout dan pembayaran menyusul di Task 8 dan 9.
                onLanjutBayar = {}
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
