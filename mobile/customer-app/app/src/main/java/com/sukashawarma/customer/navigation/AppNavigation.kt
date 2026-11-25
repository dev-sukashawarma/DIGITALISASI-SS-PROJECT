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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sukashawarma.customer.AppContainer
import com.sukashawarma.customer.BuildConfig
import com.sukashawarma.customer.data.CartTopping
import com.sukashawarma.customer.data.PreferensiNotifikasi
import com.sukashawarma.customer.data.api.ConfigDto
import com.sukashawarma.customer.data.api.GatewayResult
import com.sukashawarma.customer.data.bersihkanKredensialGoogle
import com.sukashawarma.customer.ui.cart.CartScreen
import com.sukashawarma.customer.ui.cart.CartViewModel
import com.sukashawarma.customer.ui.checkout.CheckoutScreen
import com.sukashawarma.customer.ui.checkout.CheckoutViewModel
import com.sukashawarma.customer.ui.components.BottomNavTab
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.FloatingCartBar
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.components.SukaBottomNavBar
import com.sukashawarma.customer.ui.components.inisialNama
import com.sukashawarma.customer.ui.config.LayarPerbaruiAplikasi
import com.sukashawarma.customer.ui.config.LocalConfigApp
import com.sukashawarma.customer.ui.config.perluUpdate
import com.sukashawarma.customer.ui.home.HomeScreen
import com.sukashawarma.customer.ui.home.OutletPickerScreen
import com.sukashawarma.customer.ui.home.OutletPickerViewModel
import com.sukashawarma.customer.ui.home.bolehPesan
import com.sukashawarma.customer.ui.home.labelStatusOutlet
import com.sukashawarma.customer.ui.home.pilihMenuTerlaris
import com.sukashawarma.customer.ui.menu.CatalogViewModel
import com.sukashawarma.customer.ui.menu.MenuScreen
import com.sukashawarma.customer.ui.notifications.NotificationScreen
import com.sukashawarma.customer.ui.notifications.NotificationViewModel
import com.sukashawarma.customer.ui.orders.HistoryScreen
import com.sukashawarma.customer.ui.orders.HistoryViewModel
import com.sukashawarma.customer.ui.orders.OrderStatusScreen
import com.sukashawarma.customer.ui.orders.OrderStatusViewModel
import com.sukashawarma.customer.ui.payment.PaymentViewModel
import com.sukashawarma.customer.ui.payment.PaymentWaitScreen
import com.sukashawarma.customer.ui.payment.SuccessScreen
import com.sukashawarma.customer.ui.product.ItemDetailScreen
import com.sukashawarma.customer.ui.product.ItemDetailViewModel
import com.sukashawarma.customer.ui.profile.InformasiAkunScreen
import com.sukashawarma.customer.ui.profile.InformasiAkunViewModel
import com.sukashawarma.customer.ui.profile.LoginScreen
import com.sukashawarma.customer.ui.profile.LoginViewModel
import com.sukashawarma.customer.ui.profile.ProfileScreen
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.voucher.VoucherScreen
import com.sukashawarma.customer.ui.voucher.VoucherViewModel
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

/**
 * `CatalogViewModel` dan `CartViewModel` dibuat di tingkat NavHost, BUKAN di
 * dalam masing-masing `composable`. Katalog yang sudah dimuat tidak hilang
 * saat pelanggan bolak-balik, dan keranjang punya SATU sumber kebenaran.
 */
@Composable
fun CustomerAppRoot(container: AppContainer) {
    val navController = rememberNavController()
    val konteks = LocalContext.current

    val catalogViewModel: CatalogViewModel = viewModel(
        factory = pabrik {
            CatalogViewModel(
                repository = container.repository,
                outletStore = container.outletStore,
                cart = container.cartStore,
                lokasi = container.lokasiPelanggan
            )
        }
    )
    val cartViewModel: CartViewModel = viewModel(
        factory = pabrik { CartViewModel(container.cartStore) }
    )

    var config by remember { mutableStateOf<ConfigDto?>(null) }
    val cakupanConfig = rememberCoroutineScope()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        cakupanConfig.launch {
            (container.repository.config() as? GatewayResult.Sukses)?.let { config = it.data }
        }
    }
    if (perluUpdate(BuildConfig.VERSION_CODE, config)) {
        LayarPerbaruiAplikasi()
        return
    }

    val catalogState by catalogViewModel.state.collectAsStateWithLifecycle()
    val cartState by cartViewModel.state.collectAsStateWithLifecycle()
    val unreadNotifCount by container.notificationStore.unreadCount.collectAsStateWithLifecycle()

    // Pemicu rekomposisi sederhana ketika sesi masuk/keluar berubah.
    var versiSesi by remember { mutableIntStateOf(0) }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        catalogViewModel.segarkanStatusOutlet()
    }

    LaunchedEffect(versiSesi) {
        if (container.sessionStore.adaSesiBerlaku()) {
            when (val hasil = container.repository.ambilNotifikasi()) {
                is GatewayResult.Sukses -> {
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

    fun bukaTabUtama(tujuan: String) {
        if (currentRoute == tujuan) return
        navController.navigate(tujuan) {
            popUpTo(Rute.BERANDA) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    /**
     * Pembersihan penuh saat keluar / hapus akun:
     * hapus sesi, keranjang, percobaan bayar, seluruh prefs notifikasi,
     * bersihkan state Credential Manager, dan hapus back-stack tab tersimpan
     * agar riwayat Akun A tidak pernah terbawa ke Akun B.
     */
    fun bersihkanAkun() {
        container.sessionStore.hapus()
        container.cartStore.kosongkan()
        container.orderAttemptStore.selesai()
        container.notificationStore.bersihkan()
        versiSesi++
        container.appScope.launch {
            bersihkanKredensialGoogle(konteks)
        }
        runCatching { navController.clearBackStack(Rute.RIWAYAT) }
        runCatching { navController.clearBackStack(Rute.MENU) }
        runCatching { navController.clearBackStack(Rute.PROFIL) }
        navController.navigate(Rute.BERANDA) {
            popUpTo(navController.graph.id) { inclusive = true }
            launchSingleTop = true
        }
    }

    // Penanganan HTTP 401 (SesiTidakSah) terpusat: tidak lagi menjebak pengguna
    // di tombol "Coba lagi". Keranjang tetap dipertahankan agar setelah masuk
    // ulang pelanggan bisa langsung melanjutkan.
    LaunchedEffect(Unit) {
        container.sesiHabis.collect {
            if (currentRoute == Rute.MASUK) return@collect
            container.sessionStore.hapus()
            container.notificationStore.setUnreadCount(0)
            versiSesi++
            runCatching { navController.clearBackStack(Rute.RIWAYAT) }
            val tujuanSetelahMasuk = when (currentRoute) {
                Rute.CHECKOUT, Rute.BAYAR -> "checkout"
                Rute.RIWAYAT -> "riwayat"
                Rute.VOUCHER -> "voucher"
                Rute.NOTIFIKASI -> "notifikasi"
                Rute.PROFIL, Rute.INFO_AKUN -> "profil"
                else -> "katalog"
            }
            navController.navigate(Rute.masuk(tujuanSetelahMasuk)) {
                launchSingleTop = true
            }
        }
    }

    fun inisialPelanggan(): String {
        val sesi = container.sessionStore.baca()
        return if (sesi == null) "?" else inisialNama(sesi.nama, sesi.email)
    }

    fun namaOutletKeranjang(): String? {
        val idKeranjang = container.cartStore.outletId() ?: return null
        return when {
            catalogState.outlet?.id == idKeranjang -> catalogState.outlet?.name
            container.outletStore.idTerpilih() == idKeranjang -> container.outletStore.namaTerpilih()
            else -> null
        }
    }

    CompositionLocalProvider(LocalConfigApp provides (config ?: ConfigDto())) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
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
                    SukaBottomNavBar(
                        selectedTab = when (currentRoute) {
                            Rute.MENU -> BottomNavTab.MENU
                            Rute.RIWAYAT -> BottomNavTab.PESANAN
                            Rute.PROFIL -> BottomNavTab.PROFIL
                            else -> BottomNavTab.BERANDA
                        },
                        onSelectTab = { tab ->
                            when (tab) {
                                BottomNavTab.BERANDA -> bukaTabUtama(Rute.BERANDA)
                                BottomNavTab.MENU -> bukaTabUtama(Rute.MENU)
                                BottomNavTab.PESANAN -> bukaTabUtama(Rute.RIWAYAT)
                                BottomNavTab.PROFIL -> bukaTabUtama(Rute.PROFIL)
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
                    .consumeWindowInsets(innerPadding)
            ) {
                NavHost(
                    navController = navController,
                    // Guest browse: selalu mulai di Beranda (paritas dengan iOS & panduan App Store).
                    // Login hanya diminta saat Checkout, Pesanan, Voucher, Notifikasi, atau Profil.
                    startDestination = Rute.BERANDA,
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
                                versiSesi++
                                runCatching { navController.clearBackStack(Rute.RIWAYAT) }
                                cakupanConfig.launch {
                                    (container.repository.ambilNotifikasi() as? GatewayResult.Sukses)?.let {
                                        container.notificationStore.setUnreadCount(it.data.unreadCount)
                                    }
                                }
                                when (tujuan) {
                                    "checkout" -> navController.navigate(Rute.CHECKOUT) {
                                        popUpTo(Rute.MASUK) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                    "voucher" -> navController.navigate(Rute.VOUCHER) {
                                        popUpTo(Rute.MASUK) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                    "notifikasi" -> navController.navigate(Rute.NOTIFIKASI) {
                                        popUpTo(Rute.MASUK) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                    "riwayat" -> {
                                        navController.popBackStack()
                                        bukaTabUtama(Rute.RIWAYAT)
                                    }
                                    "profil" -> {
                                        navController.popBackStack()
                                        bukaTabUtama(Rute.PROFIL)
                                    }
                                    else -> navController.navigate(Rute.BERANDA) {
                                        popUpTo(navController.graph.id) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                }
                            },
                            onKembali = if (navController.previousBackStackEntry != null) {
                                { navController.popBackStack() }
                            } else null
                        )
                    }

                    composable(Rute.INFO_AKUN) {
                        val infoAkunViewModel: InformasiAkunViewModel = viewModel(
                            factory = pabrik { InformasiAkunViewModel(container.repository, container.sessionStore) }
                        )
                        InformasiAkunScreen(
                            viewModel = infoAkunViewModel,
                            onKembali = { navController.popBackStack() },
                            onAkunDihapus = { bersihkanAkun() }
                        )
                    }

                    composable(Rute.BERANDA) {
                        HomeScreen(
                            viewModel = catalogViewModel,
                            onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                            onBukaProfil = { bukaTabUtama(Rute.PROFIL) },
                            onBukaMenu = { bukaTabUtama(Rute.MENU) },
                            onPilihItem = { navController.navigate(Rute.detail(it.id)) },
                            onBukaNotifikasi = {
                                if (container.sessionStore.adaSesiBerlaku()) {
                                    navController.navigate(Rute.NOTIFIKASI)
                                } else {
                                    navController.navigate(Rute.masuk("notifikasi"))
                                }
                            },
                            onBukaVoucher = {
                                if (container.sessionStore.adaSesiBerlaku()) {
                                    navController.navigate(Rute.VOUCHER)
                                } else {
                                    navController.navigate(Rute.masuk("voucher"))
                                }
                            },
                            unreadCount = if (container.sessionStore.adaSesiBerlaku()) unreadNotifCount else 0,
                            inisial = inisialPelanggan()
                        )
                    }

                    composable(Rute.MENU) {
                        MenuScreen(
                            viewModel = catalogViewModel,
                            onGantiOutlet = { navController.navigate(Rute.PILIH_OUTLET) },
                            onBukaProfil = { bukaTabUtama(Rute.PROFIL) },
                            onPilihItem = { navController.navigate(Rute.detail(it.id)) },
                            inisial = inisialPelanggan()
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
                            factory = pabrik { OutletPickerViewModel(container.repository, container.lokasiPelanggan) }
                        )
                        OutletPickerScreen(
                            viewModel = outletViewModel,
                            onPilih = { outlet ->
                                catalogViewModel.pilihOutlet(outlet)
                                navController.popBackStack()
                            },
                            onTutup = { navController.popBackStack() },
                            terpilihId = catalogState.outlet?.id
                        )
                    }

                    composable(
                        Rute.DETAIL,
                        arguments = listOf(navArgument("menuItemId") { type = NavType.StringType })
                    ) { entri ->
                        val menuItemId = entri.arguments?.getString("menuItemId")
                        val item = catalogState.semuaItem.firstOrNull { it.id == menuItemId }

                        if (item == null) {
                            Scaffold(
                                containerColor = SukaCream,
                                topBar = {
                                    PageBrandHeader(
                                        judul = "Detail Menu",
                                        subjudul = null,
                                        onKembali = { navController.popBackStack() }
                                    )
                                }
                            ) { pad ->
                                Box(
                                    modifier = Modifier.padding(pad).fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (catalogState.memuat) {
                                        MemuatState()
                                    } else {
                                        EmptyState(
                                            judul = "Menu tidak ditemukan",
                                            penjelasan = "Menu ini sudah tidak ada di katalog outlet."
                                        )
                                    }
                                }
                            }
                            return@composable
                        }

                        LaunchedEffect(Unit) { catalogViewModel.segarkanStatusOutlet() }

                        val detailViewModel: ItemDetailViewModel = viewModel(
                            factory = pabrik { ItemDetailViewModel() }
                        )
                        val toppings = remember(catalogState.semuaItem) {
                            catalogState.semuaItem.filter {
                                it.categoryName.equals("Topping", ignoreCase = true) && it.isAvailable
                            }
                        }
                        val menuTerlarisIds = LocalConfigApp.current.menuTerlarisIds
                        val isBestSeller = remember(catalogState.semuaItem, menuTerlarisIds, item.id) {
                            pilihMenuTerlaris(catalogState.semuaItem, menuTerlarisIds).any { it.id == item.id }
                        }
                        ItemDetailScreen(
                            item = item,
                            viewModel = detailViewModel,
                            availableToppings = if (
                                item.categoryName.equals("Topping", ignoreCase = true) ||
                                item.categoryName.equals("Suka Drink", ignoreCase = true)
                            ) emptyList() else toppings,
                            cartLines = cartState.baris,
                            cartSubtotal = cartState.subtotal,
                            cartTotalPorsi = cartState.porsi,
                            isBestSeller = isBestSeller,
                            outletBolehPesan = catalogState.outlet?.bolehPesan() != false,
                            labelOutletTutup = catalogState.outlet?.let { if (!it.bolehPesan()) labelStatusOutlet(it) else null },
                            onLihatKeranjang = {
                                navController.navigate(Rute.KERANJANG) { launchSingleTop = true }
                            },
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
                        LaunchedEffect(Unit) { catalogViewModel.segarkanStatusOutlet() }
                        var konfirmasiOutletOtomatis by remember { mutableStateOf(false) }

                        fun lanjutKeCheckout() {
                            if (container.sessionStore.adaSesiBerlaku()) {
                                navController.navigate(Rute.CHECKOUT) { launchSingleTop = true }
                            } else {
                                navController.navigate(Rute.masuk("checkout")) { launchSingleTop = true }
                            }
                        }

                        if (konfirmasiOutletOtomatis) {
                            val namaOutletSaatIni = namaOutletKeranjang() ?: catalogState.outlet?.name ?: "outlet ini"
                            AlertDialog(
                                onDismissRequest = { konfirmasiOutletOtomatis = false },
                                containerColor = Color.White,
                                shape = RoundedCornerShape(22.dp),
                                title = {
                                    Text(
                                        text = "Konfirmasi Outlet Ambil",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SukaBrown
                                        )
                                    )
                                },
                                text = {
                                    Text(
                                        text = "Pesanan ini akan disiapkan untuk diambil di $namaOutletSaatIni. Pastikan lokasinya sesuai sebelum lanjut membayar.",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = SukaInk,
                                            lineHeight = 18.sp
                                        )
                                    )
                                },
                                confirmButton = {
                                    Button(
                                        onClick = {
                                            konfirmasiOutletOtomatis = false
                                            catalogViewModel.konfirmasiOutletSaatIni()
                                            lanjutKeCheckout()
                                        },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = SukaOrange,
                                            contentColor = SukaInk
                                        )
                                    ) {
                                        Text("Benar, Lanjut", fontWeight = FontWeight.ExtraBold)
                                    }
                                },
                                dismissButton = {
                                    TextButton(
                                        onClick = {
                                            konfirmasiOutletOtomatis = false
                                            navController.navigate(Rute.PILIH_OUTLET)
                                        }
                                    ) {
                                        Text("Ganti Outlet", color = SukaBrown, fontWeight = FontWeight.Bold)
                                    }
                                }
                            )
                        }

                        CartScreen(
                            viewModel = cartViewModel,
                            onKembali = { navController.popBackStack() },
                            onLanjutBayar = {
                                // Pengaman agar outlet default (belum dipilih eksplisit/GPS)
                                // dikonfirmasi 1x sebelum masuk ke pembayaran.
                                if (catalogState.outletOtomatis) {
                                    konfirmasiOutletOtomatis = true
                                } else {
                                    lanjutKeCheckout()
                                }
                            },
                            namaOutlet = namaOutletKeranjang(),
                            outletBolehPesan = catalogState.outlet?.bolehPesan() != false,
                            labelOutletTutup = catalogState.outlet?.let { if (!it.bolehPesan()) labelStatusOutlet(it) else null }
                        )
                    }

                    composable(Rute.CHECKOUT) {
                        LaunchedEffect(Unit) { catalogViewModel.segarkanStatusOutlet() }
                        val checkoutViewModel: CheckoutViewModel = viewModel(
                            factory = pabrik { CheckoutViewModel(container.repository, container.cartStore) }
                        )
                        CheckoutScreen(
                            viewModel = checkoutViewModel,
                            onKembali = { navController.popBackStack() },
                            onBayar = { navController.navigate(Rute.BAYAR) { launchSingleTop = true } },
                            namaOutlet = namaOutletKeranjang(),
                            outletBolehPesan = catalogState.outlet?.bolehPesan() != false,
                            labelOutletTutup = catalogState.outlet?.let { if (!it.bolehPesan()) labelStatusOutlet(it) else null }
                        )
                    }

                    composable(Rute.BAYAR) {
                        val paymentViewModel: PaymentViewModel = viewModel(
                            factory = pabrik {
                                PaymentViewModel(
                                    repository = container.repository,
                                    cart = container.cartStore,
                                    percobaan = container.orderAttemptStore,
                                    appScope = container.appScope
                                )
                            }
                        )

                        LaunchedEffect(Unit) { paymentViewModel.mulai() }

                        PaymentWaitScreen(
                            viewModel = paymentViewModel,
                            onSelesai = { nomor ->
                                val orderId = paymentViewModel.state.value.orderId
                                if (orderId != null) {
                                    navController.navigate(Rute.sukses(orderId, nomor)) {
                                        popUpTo(Rute.KATALOG)
                                    }
                                } else {
                                    navController.popBackStack(Rute.KATALOG, inclusive = false)
                                }
                            },
                            onKembaliKeRingkasan = { navController.popBackStack() },
                            onLihatRiwayat = { bukaTabUtama(Rute.RIWAYAT) }
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
                            namaOutlet = catalogState.outlet?.name ?: container.outletStore.namaTerpilih(),
                            onLihatStatus = {
                                navController.navigate(Rute.status(orderId)) {
                                    popUpTo(Rute.SUKSES) { inclusive = true }
                                }
                            },
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
                        val adaSesi = remember(versiSesi) { container.sessionStore.adaSesiBerlaku() }
                        if (!adaSesi) {
                            GuestMasukGate(
                                judulHeader = "Riwayat Pesanan",
                                subjudulHeader = "Pantau status & riwayat pesananmu",
                                judul = "Masuk untuk Melihat Pesanan",
                                penjelasan = "Riwayat pesanan dan status dapur tersimpan aman di akun Google kamu.",
                                onMasuk = { navController.navigate(Rute.masuk("riwayat")) { launchSingleTop = true } }
                            )
                        } else {
                            val historyViewModel: HistoryViewModel = viewModel(
                                factory = pabrik { HistoryViewModel(container.repository) }
                            )
                            HistoryScreen(
                                viewModel = historyViewModel,
                                onBukaPesanan = { navController.navigate(Rute.status(it)) },
                                onKembali = { bukaTabUtama(Rute.BERANDA) },
                                onBukaProfil = { bukaTabUtama(Rute.PROFIL) },
                                inisial = inisialPelanggan()
                            )
                        }
                    }

                    composable(Rute.PROFIL) {
                        val sesiSaatIni = remember(versiSesi) {
                            if (container.sessionStore.adaSesiBerlaku()) container.sessionStore.baca() else null
                        }
                        var preferensi by remember(versiSesi) {
                            mutableStateOf(container.notificationStore.bacaPreferensi())
                        }

                        ProfileScreen(
                            sesi = sesiSaatIni,
                            statusPesananAktif = preferensi.statusPesanan,
                            promoAktif = preferensi.promo,
                            onSimpanPreferensiNotifikasi = { statusPesanan, promo ->
                                container.notificationStore.simpanPreferensi(statusPesanan, promo)
                                preferensi = PreferensiNotifikasi(statusPesanan, promo)
                                container.appScope.launch {
                                    container.repository.simpanPreferensiNotifikasi(pesanan = statusPesanan, promo = promo)
                                }
                            },
                            onMasuk = { navController.navigate(Rute.masuk("profil")) { launchSingleTop = true } },
                            onKeluar = { bersihkanAkun() },
                            onBukaInfoAkun = { navController.navigate(Rute.INFO_AKUN) },
                            onBukaVoucher = { navController.navigate(Rute.VOUCHER) },
                            onLihatRiwayat = { bukaTabUtama(Rute.RIWAYAT) },
                            onKembali = { bukaTabUtama(Rute.BERANDA) }
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
                            onBukaMenu = { bukaTabUtama(Rute.MENU) },
                            onKembali = { navController.popBackStack() }
                        )
                    }

                    composable(Rute.VOUCHER) {
                        val voucherViewModel: VoucherViewModel = viewModel(
                            factory = pabrik {
                                VoucherViewModel(muat = { container.repository.vouchers() }, cart = container.cartStore)
                            }
                        )
                        VoucherScreen(
                            viewModel = voucherViewModel,
                            onKembali = { navController.popBackStack() },
                            onSetelahPakai = { bukaTabUtama(Rute.MENU) }
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
                        onKlik = { navController.navigate(Rute.KERANJANG) { launchSingleTop = true } }
                    )
                }
            }
        }
    }
}

@Composable
private fun GuestMasukGate(
    judulHeader: String,
    subjudulHeader: String,
    judul: String,
    penjelasan: String,
    onMasuk: () -> Unit
) {
    Scaffold(
        containerColor = SukaCream,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            PageBrandHeader(
                judul = judulHeader,
                subjudul = subjudulHeader,
                onKembali = null
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = judul,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SukaBrown
                    ),
                    textAlign = TextAlign.Center
                )
                Text(
                    text = penjelasan,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = SukaMuted,
                        lineHeight = 20.sp
                    ),
                    textAlign = TextAlign.Center
                )
                Button(
                    onClick = onMasuk,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp)
                        .height(48.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = SukaOrange,
                        contentColor = SukaInk
                    )
                ) {
                    Text("Masuk dengan Google", fontWeight = FontWeight.ExtraBold)
                }
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
