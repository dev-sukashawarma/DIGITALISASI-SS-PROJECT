package com.sukashawarma.customer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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
import com.sukashawarma.customer.ui.screens.checkout.CheckoutScreen
import com.sukashawarma.customer.ui.screens.checkout.CheckoutViewModel
import com.sukashawarma.customer.ui.screens.detail.ItemDetailScreen
import com.sukashawarma.customer.ui.screens.detail.ItemDetailViewModel
import com.sukashawarma.customer.ui.screens.login.LoginScreen
import com.sukashawarma.customer.ui.screens.login.LoginViewModel
import com.sukashawarma.customer.ui.screens.history.HistoryScreen
import com.sukashawarma.customer.ui.screens.history.HistoryViewModel
import com.sukashawarma.customer.ui.screens.onboarding.OnboardingScreen
import com.sukashawarma.customer.ui.screens.payment.PaymentViewModel
import com.sukashawarma.customer.ui.screens.payment.PaymentWaitScreen
import com.sukashawarma.customer.ui.screens.profile.ProfileScreen
import com.sukashawarma.customer.ui.screens.status.OrderStatusScreen
import com.sukashawarma.customer.ui.screens.status.OrderStatusViewModel
import com.sukashawarma.customer.ui.screens.success.SuccessScreen
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
    const val ONBOARDING = "onboarding"

    /**
     * `tujuan` menentukan ke mana pelanggan dibawa setelah berhasil masuk.
     * Tanpa ini, masuk dari titik bayar akan melempar pelanggan kembali ke
     * katalog dan memaksanya menyusuri keranjang lagi dari awal.
     */
    const val MASUK = "masuk?tujuan={tujuan}"
    fun masuk(tujuan: String = "katalog") = "masuk?tujuan=$tujuan"

    const val KATALOG = "katalog"
    const val PILIH_OUTLET = "pilih-outlet"
    const val KERANJANG = "keranjang"
    const val CHECKOUT = "checkout"
    const val DETAIL = "detail/{menuItemId}"
    fun detail(menuItemId: String) = "detail/$menuItemId"

    const val BAYAR = "bayar"
    const val SUKSES = "sukses/{orderId}?nomor={nomor}"
    fun sukses(orderId: String, nomor: Int?) = "sukses/$orderId?nomor=${nomor ?: -1}"
    const val STATUS = "status/{orderId}"
    fun status(orderId: String) = "status/$orderId"
    const val RIWAYAT = "riwayat"
    const val PROFIL = "profil"
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

    // Sesi yang masih berlaku melewati perkenalan. Pemeriksaan ini hanya
    // kemudahan -- gateway tetap penentu sah atau tidaknya sesi, dan akan
    // menolak dengan 401 kalau ternyata sudah tidak berlaku.
    val mulaiDari = remember {
        if (container.sessionStore.adaSesiBerlaku()) Rute.KATALOG else Rute.ONBOARDING
    }

    NavHost(navController = navController, startDestination = mulaiDari) {

        composable(Rute.ONBOARDING) {
            OnboardingScreen(
                onMasuk = { navController.navigate(Rute.masuk()) },
                onLihatMenu = {
                    navController.navigate(Rute.KATALOG) {
                        popUpTo(Rute.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(
            Rute.MASUK,
            arguments = listOf(
                navArgument("tujuan") {
                    type = NavType.StringType
                    defaultValue = "katalog"
                }
            )
        ) { entri ->
            val tujuan = entri.arguments?.getString("tujuan") ?: "katalog"
            val loginViewModel: LoginViewModel = viewModel(
                factory = pabrik { LoginViewModel(container.repository, container.sessionStore) }
            )
            LoginScreen(
                viewModel = loginViewModel,
                onBerhasil = {
                    if (tujuan == "checkout") {
                        navController.navigate(Rute.CHECKOUT) {
                            popUpTo(Rute.MASUK) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Rute.KATALOG) {
                            popUpTo(Rute.ONBOARDING) { inclusive = true }
                        }
                    }
                },
                onLihatMenu = {
                    navController.navigate(Rute.KATALOG) {
                        popUpTo(Rute.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Rute.KATALOG) {
            CatalogScreen(
                viewModel = catalogViewModel,
                porsiKeranjang = cartState.porsi,
                subtotalKeranjang = cartState.subtotal,
                onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                onPilihItem = { navController.navigate(Rute.detail(it.id)) },
                onBukaKeranjang = { navController.navigate(Rute.KERANJANG) },
                onBukaRiwayat = { navController.navigate(Rute.RIWAYAT) },
                onBukaProfil = { navController.navigate(Rute.PROFIL) }
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
                // Login diminta DI SINI, di titik bayar -- bukan di pintu
                // masuk aplikasi. Pelanggan boleh menjelajah menu dan menyusun
                // keranjang tanpa akun; `/checkout/validate` yang menuntut sesi.
                onLanjutBayar = {
                    if (container.sessionStore.adaSesiBerlaku()) {
                        navController.navigate(Rute.CHECKOUT)
                    } else {
                        navController.navigate(Rute.masuk("checkout"))
                    }
                }
            )
        }

        composable(Rute.CHECKOUT) {
            // Dibuat di dalam `composable` supaya validasi dijalankan ulang
            // setiap kali layar ini dibuka. Harga dan ketersediaan bisa
            // berubah di antara dua kunjungan, dan validasi basi di titik
            // pembayaran justru hal yang paling berbahaya.
            val checkoutViewModel: CheckoutViewModel = viewModel(
                factory = pabrik { CheckoutViewModel(container.repository, container.cartStore) }
            )
            CheckoutScreen(
                viewModel = checkoutViewModel,
                onKembali = {
                    // Pemulihan di layar checkout mengubah keranjang.
                    // Tampilan keranjang harus ikut menyusul.
                    cartViewModel.segarkan()
                    navController.popBackStack()
                },
                onBayar = { navController.navigate(Rute.BAYAR) }
            )
        }

        composable(Rute.BAYAR) {
            val paymentViewModel: PaymentViewModel = viewModel(
                factory = pabrik {
                    PaymentViewModel(
                        container.repository,
                        container.cartStore,
                        container.orderAttemptStore
                    )
                }
            )

            // Percobaan yang tertinggal (aplikasi sempat dimatikan Android
            // selama pelanggan berada di halaman pembayaran) DILANJUTKAN,
            // bukan dimulai ulang. Memulai ulang berarti tagihan kedua.
            LaunchedEffect(Unit) {
                if (!paymentViewModel.lanjutkanJikaAda()) paymentViewModel.bayar()
            }

            PaymentWaitScreen(
                viewModel = paymentViewModel,
                onSelesai = { nomor ->
                    val orderId = paymentViewModel.state.value.orderId
                    cartViewModel.segarkan()
                    if (orderId != null) {
                        navController.navigate(Rute.sukses(orderId, nomor)) {
                            popUpTo(Rute.KATALOG)
                        }
                    } else {
                        navController.popBackStack(Rute.KATALOG, inclusive = false)
                    }
                },
                onKembaliKeRingkasan = { navController.popBackStack() },
                onLihatRiwayat = { navController.navigate(Rute.RIWAYAT) }
            )
        }

        composable(
            Rute.SUKSES,
            arguments = listOf(
                navArgument("orderId") { type = NavType.StringType },
                navArgument("nomor") {
                    type = NavType.IntType
                    defaultValue = -1
                }
            )
        ) { entri ->
            val orderId = entri.arguments?.getString("orderId").orEmpty()
            val nomor = entri.arguments?.getInt("nomor")?.takeIf { it > 0 }
            SuccessScreen(
                nomorPesanan = nomor,
                namaOutlet = catalogState.outlet?.name,
                onLihatStatus = { navController.navigate(Rute.status(orderId)) },
                onKembaliKeKatalog = {
                    navController.popBackStack(Rute.KATALOG, inclusive = false)
                }
            )
        }

        composable(
            Rute.STATUS,
            arguments = listOf(navArgument("orderId") { type = NavType.StringType })
        ) { entri ->
            val orderId = entri.arguments?.getString("orderId").orEmpty()
            val statusViewModel: OrderStatusViewModel = viewModel(
                factory = pabrik { OrderStatusViewModel(container.repository, orderId) }
            )
            OrderStatusScreen(
                viewModel = statusViewModel,
                onKembali = { navController.popBackStack() }
            )
        }

        composable(Rute.RIWAYAT) {
            val historyViewModel: HistoryViewModel = viewModel(
                factory = pabrik { HistoryViewModel(container.repository) }
            )
            HistoryScreen(
                viewModel = historyViewModel,
                onBukaPesanan = { navController.navigate(Rute.status(it)) },
                onKembali = { navController.popBackStack() }
            )
        }

        composable(Rute.PROFIL) {
            ProfileScreen(
                sesi = container.sessionStore.baca(),
                onKeluar = {
                    container.sessionStore.hapus()
                    navController.navigate(Rute.ONBOARDING) {
                        popUpTo(Rute.KATALOG) { inclusive = true }
                    }
                },
                onLihatRiwayat = { navController.navigate(Rute.RIWAYAT) },
                onKembali = { navController.popBackStack() }
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
