package com.sukashawarma.customer.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Alignment
import androidx.compose.ui.zIndex
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sukashawarma.customer.AppContainer
import com.sukashawarma.customer.ui.cart.CartScreen
import com.sukashawarma.customer.ui.cart.CartViewModel
import com.sukashawarma.customer.ui.checkout.CheckoutScreen
import com.sukashawarma.customer.ui.checkout.CheckoutViewModel
import com.sukashawarma.customer.ui.components.BottomNavTab
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.FloatingCartBar
import com.sukashawarma.customer.ui.components.SukaBottomNavBar
import com.sukashawarma.customer.ui.home.HomeScreen
import com.sukashawarma.customer.ui.home.OnboardingScreen
import com.sukashawarma.customer.ui.home.OutletPickerScreen
import com.sukashawarma.customer.ui.home.OutletPickerViewModel
import com.sukashawarma.customer.ui.menu.CatalogScreen
import com.sukashawarma.customer.ui.menu.CatalogViewModel
import com.sukashawarma.customer.ui.menu.MenuScreen
import com.sukashawarma.customer.ui.orders.HistoryScreen
import com.sukashawarma.customer.ui.orders.HistoryViewModel
import com.sukashawarma.customer.ui.orders.OrderStatusScreen
import com.sukashawarma.customer.ui.orders.OrderStatusViewModel
import com.sukashawarma.customer.ui.payment.PaymentViewModel
import com.sukashawarma.customer.ui.payment.PaymentWaitScreen
import com.sukashawarma.customer.ui.payment.SuccessScreen
import com.sukashawarma.customer.ui.product.ItemDetailScreen
import com.sukashawarma.customer.ui.product.ItemDetailViewModel
import com.sukashawarma.customer.ui.profile.LoginScreen
import com.sukashawarma.customer.ui.profile.LoginViewModel
import com.sukashawarma.customer.ui.profile.ProfileScreen
import com.sukashawarma.customer.ui.notifications.NotificationScreen
import com.sukashawarma.customer.ui.notifications.NotificationViewModel
import com.sukashawarma.customer.data.CartTopping
import com.sukashawarma.customer.data.PreferensiNotifikasi
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

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
    val unreadNotifCount by container.notificationStore.unreadCount.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        if (container.sessionStore.adaSesiBerlaku()) {
            when (val hasil = container.repository.ambilNotifikasi()) {
                is com.sukashawarma.customer.data.api.GatewayResult.Sukses -> {
                    container.notificationStore.setUnreadCount(hasil.data.unreadCount)
                }
                else -> {}
            }
        }
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val topLevelRoutes = remember { setOf(Rute.BERANDA, Rute.MENU, Rute.RIWAYAT, Rute.PROFIL) }
    val isTopLevelDestination = currentRoute in topLevelRoutes

    // Sesi yang masih berlaku melewati perkenalan. Pemeriksaan ini hanya
    // kemudahan -- gateway tetap penentu sah atau tidaknya sesi, dan akan
    // menolak dengan 401 kalau ternyata sudah tidak berlaku.
    val mulaiDari = remember {
        if (container.sessionStore.adaSesiBerlaku()) Rute.BERANDA else Rute.ONBOARDING
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            AnimatedVisibility(
                visible = isTopLevelDestination,
                enter = slideInVertically(
                    initialOffsetY = { it },
                    animationSpec = tween(durationMillis = 260, easing = FastOutSlowInEasing)
                ) + fadeIn(animationSpec = tween(200)),
                exit = slideOutVertically(
                    targetOffsetY = { it },
                    animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing)
                ) + fadeOut(animationSpec = tween(180))
            ) {
                // Bottom Navigation Bar Terpadu & Persisten (Murni Nav Bar, tanpa container keranjang yang mendorong layout)
                SukaBottomNavBar(
                    selectedTab = when (currentRoute) {
                        Rute.MENU -> BottomNavTab.MENU
                        Rute.RIWAYAT -> BottomNavTab.PESANAN
                        Rute.PROFIL -> BottomNavTab.PROFIL
                        else -> BottomNavTab.BERANDA
                    },
                    onSelectTab = { tab ->
                        when (tab) {
                            BottomNavTab.BERANDA -> {
                                if (currentRoute != Rute.BERANDA) {
                                    navController.navigate(Rute.BERANDA) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                            BottomNavTab.MENU -> {
                                if (currentRoute != Rute.MENU) {
                                    navController.navigate(Rute.MENU) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                            BottomNavTab.PESANAN -> {
                                if (currentRoute != Rute.RIWAYAT) {
                                    navController.navigate(Rute.RIWAYAT) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                            BottomNavTab.PROFIL -> {
                                if (currentRoute != Rute.PROFIL) {
                                    navController.navigate(Rute.PROFIL) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
        ) {
            NavHost(
                navController = navController,
                startDestination = mulaiDari,
                modifier = Modifier.fillMaxSize(),
            enterTransition = {
                val from = initialState.destination.route
                val to = targetState.destination.route
                val isBetweenTabs = from in topLevelRoutes && to in topLevelRoutes
                if (isBetweenTabs) {
                    fadeIn(animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing))
                } else {
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Start,
                        animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing)
                    ) + fadeIn(animationSpec = tween(220))
                }
            },
            exitTransition = {
                val from = initialState.destination.route
                val to = targetState.destination.route
                val isBetweenTabs = from in topLevelRoutes && to in topLevelRoutes
                if (isBetweenTabs) {
                    fadeOut(animationSpec = tween(durationMillis = 180, easing = FastOutSlowInEasing))
                } else {
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Start,
                        animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing)
                    ) + fadeOut(animationSpec = tween(200))
                }
            },
            popEnterTransition = {
                val from = initialState.destination.route
                val to = targetState.destination.route
                val isBetweenTabs = from in topLevelRoutes && to in topLevelRoutes
                if (isBetweenTabs) {
                    fadeIn(animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing))
                } else {
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.End,
                        animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing)
                    ) + fadeIn(animationSpec = tween(220))
                }
            },
            popExitTransition = {
                val from = initialState.destination.route
                val to = targetState.destination.route
                val isBetweenTabs = from in topLevelRoutes && to in topLevelRoutes
                if (isBetweenTabs) {
                    fadeOut(animationSpec = tween(durationMillis = 180, easing = FastOutSlowInEasing))
                } else {
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.End,
                        animationSpec = tween(durationMillis = 280, easing = FastOutSlowInEasing)
                    ) + fadeOut(animationSpec = tween(200))
                }
            }
        ) {

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

            composable(Rute.BERANDA) {
                HomeScreen(
                    viewModel = catalogViewModel,
                    onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                    onBukaProfil = {
                        navController.navigate(Rute.PROFIL) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onBukaMenu = {
                        navController.navigate(Rute.MENU) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onPilihItem = { navController.navigate(Rute.detail(it.id)) },
                    onBukaNotifikasi = { navController.navigate(Rute.NOTIFIKASI) },
                    unreadCount = unreadNotifCount
                )
            }

            composable(Rute.MENU) {
                MenuScreen(
                    viewModel = catalogViewModel,
                    onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                    onBukaProfil = {
                        navController.navigate(Rute.PROFIL) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onPilihItem = { navController.navigate(Rute.detail(it.id)) }
                )
            }

            composable(
                Rute.PILIH_OUTLET,
                enterTransition = {
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Up,
                        animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing)
                    ) + fadeIn(animationSpec = tween(250))
                },
                exitTransition = {
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Down,
                        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing)
                    ) + fadeOut(animationSpec = tween(200))
                },
                popEnterTransition = {
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Up,
                        animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing)
                    ) + fadeIn(animationSpec = tween(250))
                },
                popExitTransition = {
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Down,
                        animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing)
                    ) + fadeOut(animationSpec = tween(200))
                }
            ) {
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
                    },
                    onTutup = { navController.popBackStack() }
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
                val toppings = remember(catalogState.semuaItem) {
                    catalogState.semuaItem.filter {
                        it.categoryName.equals("Topping", ignoreCase = true) && it.isAvailable
                    }
                }
                ItemDetailScreen(
                    item = item,
                    viewModel = detailViewModel,
                    availableToppings = if (item.categoryName.equals("Topping", ignoreCase = true) || item.categoryName.equals("Suka Drink", ignoreCase = true)) emptyList() else toppings,
                    cartLines = cartState.baris,
                    cartSubtotal = cartState.subtotal,
                    cartTotalPorsi = cartState.porsi,
                    onLihatKeranjang = { navController.navigate(Rute.KERANJANG) },
                    onKembali = { navController.popBackStack() },
                    onTambahKeKeranjang = { jumlah, catatan, selectedToppings ->
                        val subToppings = selectedToppings.map { topping ->
                            CartTopping(
                                menuItemId = topping.id,
                                nama = topping.name,
                                hargaSatuan = topping.price.roundToLong()
                            )
                        }
                        cartViewModel.tambah(
                            menuItemId = item.id,
                            nama = item.name,
                            // Rupiah tidak punya satuan pecahan. Pembulatan
                            // dilakukan SEKALI di sini; gateway membandingkan
                            // `unit_price` dengan katalog memakai kesamaan persis.
                            hargaSatuan = item.price.roundToLong(),
                            jumlah = jumlah,
                            catatan = catatan,
                            toppings = subToppings
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

                // `mulai()` yang memutuskan: melanjutkan percobaan tertinggal,
                // atau membuat pesanan baru kalau yang lama sudah mati. Keputusan
                // itu ada di ViewModel karena butuh memeriksa status ke gateway
                // lebih dulu -- bukan sesuatu yang bisa ditebak dari sini.
                LaunchedEffect(Unit) { paymentViewModel.mulai() }

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
                    onLihatRiwayat = {
                        navController.navigate(Rute.RIWAYAT) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
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
                ),
                enterTransition = {
                    fadeIn(animationSpec = tween(durationMillis = 350, easing = FastOutSlowInEasing)) +
                        scaleIn(initialScale = 0.92f, animationSpec = tween(durationMillis = 350, easing = FastOutSlowInEasing))
                },
                exitTransition = {
                    fadeOut(animationSpec = tween(durationMillis = 250, easing = FastOutSlowInEasing))
                }
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
                    onKembali = {
                        navController.navigate(Rute.KATALOG) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onBukaProfil = {
                        navController.navigate(Rute.PROFIL) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }

            composable(Rute.PROFIL) {
                var preferensi by remember { mutableStateOf(container.notificationStore.bacaPreferensi()) }
                val coroutineScope = rememberCoroutineScope()

                ProfileScreen(
                    sesi = container.sessionStore.baca(),
                    statusPesananAktif = preferensi.statusPesanan,
                    promoAktif = preferensi.promo,
                    onSimpanPreferensiNotifikasi = { statusPesanan, promo ->
                        container.notificationStore.simpanPreferensi(statusPesanan, promo)
                        preferensi = PreferensiNotifikasi(statusPesanan, promo)
                        coroutineScope.launch {
                            container.repository.simpanPreferensiNotifikasi(pesanan = statusPesanan, promo = promo)
                        }
                    },
                    onKeluar = {
                        container.sessionStore.hapus()
                        navController.navigate(Rute.ONBOARDING) {
                            popUpTo(Rute.KATALOG) { inclusive = true }
                        }
                    },
                    onLihatRiwayat = {
                        navController.navigate(Rute.RIWAYAT) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onKembali = {
                        navController.navigate(Rute.KATALOG) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }

            composable(Rute.NOTIFIKASI) {
                val notifViewModel: NotificationViewModel = viewModel(
                    factory = pabrik {
                        NotificationViewModel(container.repository, container.notificationStore)
                    }
                )
                NotificationScreen(
                    viewModel = notifViewModel,
                    onBukaStatusPesanan = { orderId ->
                        navController.navigate(Rute.status(orderId))
                    },
                    onBukaMenu = {
                        navController.navigate(Rute.MENU)
                    },
                    onKembali = {
                        navController.popBackStack()
                    }
                )
            }
        }

        // Floating Cart Pill Bar - Murni Floating Overlay di Depan dengan Z-Index
        AnimatedVisibility(
            visible = (currentRoute == Rute.BERANDA || currentRoute == Rute.MENU) && cartState.porsi > 0,
            enter = slideInVertically(
                initialOffsetY = { it },
                animationSpec = tween(durationMillis = 240, easing = FastOutSlowInEasing)
            ) + fadeIn(animationSpec = tween(200)),
            exit = slideOutVertically(
                targetOffsetY = { it },
                animationSpec = tween(durationMillis = 200, easing = FastOutSlowInEasing)
            ) + fadeOut(animationSpec = tween(150)),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .zIndex(50f)
        ) {
            FloatingCartBar(
                porsi = cartState.porsi,
                subtotal = cartState.subtotal,
                onKlik = { navController.navigate(Rute.KERANJANG) }
            )
        }
    }
}
}

/** Pabrik ViewModel sederhana untuk dependensi yang dirakit tangan. */
private fun <T : ViewModel> pabrik(buat: () -> T): ViewModelProvider.Factory =
    object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <VM : ViewModel> create(modelClass: Class<VM>): VM = buat() as VM
    }
