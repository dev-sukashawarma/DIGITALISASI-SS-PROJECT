package com.sukashawarma.customer.ui.home

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.BannerDilihatStore
import com.sukashawarma.customer.data.api.BannerDto
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.data.api.OutletDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.HomeBrandHeader
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.OutletHeader
import com.sukashawarma.customer.ui.components.PromoPopupDialog
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.menu.CatalogViewModel
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint
import kotlin.math.roundToLong
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    viewModel: CatalogViewModel,
    onGantiOutlet: () -> Unit,
    onBukaProfil: () -> Unit,
    onBukaMenu: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    onBukaNotifikasi: () -> Unit = {},
    unreadCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // Ke mana ketukan banner (carousel maupun popup) membawa pelanggan.
    // Menu tujuan yang tidak ada di katalog outlet ini jatuh ke onBukaMenu(),
    // bukan diam saja -- ketukan yang tidak melakukan apa pun terbaca
    // sebagai aplikasi rusak.
    fun bukaTujuan(tujuan: TujuanBanner) {
        when (tujuan) {
            is TujuanBanner.TidakAda -> Unit
            is TujuanBanner.Menu -> onBukaMenu()
            is TujuanBanner.Item -> state.semuaItem
                .firstOrNull { it.id == tujuan.menuItemId }
                ?.let(onPilihItem)
                ?: onBukaMenu()
        }
    }

    val konteks = LocalContext.current
    val dilihatStore = remember { BannerDilihatStore(konteks) }
    var sudahDilihat by remember { mutableStateOf(dilihatStore.sudahDilihat()) }

    // Dialog Promo Popup muncul saat tiba di Beranda (sebelum berinteraksi lebih jauh),
    // sekali per banner per pelanggan (keputusan owner K3).
    val popup = state.bannerPopup
    if (popupBolehTampil(popup?.id, sudahDilihat) && popup != null &&
        state.outlet != null && !state.memuat && state.galat == null
    ) {
        PromoPopupDialog(
            imageUrl = popup.gambarUrl,
            badgeText = popup.badge,
            judul = popup.judul,
            subjudul = popup.subjudul,
            teksTombol = popup.teksTombol,
            onDismiss = {
                dilihatStore.tandai(popup.id)
                sudahDilihat = dilihatStore.sudahDilihat()
            },
            onKlaimPromo = {
                dilihatStore.tandai(popup.id)
                sudahDilihat = dilihatStore.sudahDilihat()
                bukaTujuan(tujuanBanner(popup.aksi, popup.targetMenuItemId))
            }
        )
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            when {
                state.memuat -> MemuatState()

                state.tidakAdaOutlet -> EmptyState(
                    judul = "Belum ada outlet",
                    penjelasan = "Pemesanan lewat aplikasi belum dibuka di outlet mana pun. Coba lagi nanti."
                )

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                state.outlet != null && !state.outlet!!.isActive -> OutletClosedScreen(
                    namaOutlet = state.outlet!!.name,
                    onGantiOutlet = onGantiOutlet
                )

                else -> {
                    // Best Seller Items kurasi (dapat dikonfigurasi)
                    val bestSellerKeywords = remember { listOf("Ayam", "Sapi") }
                    val bestSellerItems = remember(state.semuaItem) {
                        val matched = mutableListOf<MenuItemDto>()
                        bestSellerKeywords.forEach { keyword ->
                            state.semuaItem.firstOrNull { it.name.contains(keyword, ignoreCase = true) && it.isAvailable }?.let {
                                if (!matched.contains(it)) matched.add(it)
                            }
                        }
                        if (matched.isEmpty()) {
                            state.semuaItem.filter { it.isAvailable }.take(2)
                        } else {
                            matched.take(2)
                        }
                    }

                    HomeContentList(
                        outlet = state.outlet,
                        bannerCarousel = state.bannerCarousel,
                        bestSellerItems = bestSellerItems,
                        onGantiOutlet = onGantiOutlet,
                        onBukaProfil = onBukaProfil,
                        onBukaMenu = onBukaMenu,
                        onPilihItem = onPilihItem,
                        onKetukBanner = { banner -> bukaTujuan(tujuanBanner(banner.aksi, banner.targetMenuItemId)) },
                        onBukaNotifikasi = onBukaNotifikasi,
                        unreadCount = unreadCount
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeContentList(
    outlet: OutletDto?,
    bannerCarousel: List<BannerDto>,
    bestSellerItems: List<MenuItemDto>,
    onGantiOutlet: () -> Unit,
    onBukaProfil: () -> Unit,
    onBukaMenu: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    onKetukBanner: (BannerDto) -> Unit,
    onBukaNotifikasi: () -> Unit,
    unreadCount: Int,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(top = 0.dp, bottom = 80.dp)
    ) {
        // 0. Header Brand Heritage Melengkung (Stitch Option 2)
        outlet?.let {
            item(key = "home-brand-header") {
                HomeBrandHeader(
                    namaOutlet = it.name,
                    buka = it.isActive,
                    onGantiOutlet = onGantiOutlet,
                    onBukaProfil = onBukaProfil,
                    onBukaNotifikasi = onBukaNotifikasi,
                    unreadCount = unreadCount
                )
            }
        }
        // 1. Multi-Slide Promo Media Carousel -- tidak dirender sama sekali
        // saat kosong, supaya Beranda tanpa banner aktif langsung ke daftar
        // menu tanpa ruang kosong.
        if (bannerCarousel.isNotEmpty()) {
            item(key = "home-promo-carousel") {
                PromoMediaCarousel(
                    slides = bannerCarousel,
                    onKetuk = onKetukBanner
                )
            }
        }

        // 3. Section Menu Terlaris (Best Seller)
        if (bestSellerItems.isNotEmpty()) {
            item(key = "home-best-sellers") {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Section Header
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "🔥 Menu Terlaris (Best Seller)",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 15.sp
                                )
                            )
                            Text(
                                text = "Paling dicari & favorit pelanggan",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = SukaMuted,
                                    fontSize = 10.sp
                                )
                            )
                        }

                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { onBukaMenu() }
                                .padding(vertical = 3.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            Text(
                                text = "Lihat Semua",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaOrange,
                                    fontSize = 11.sp
                                )
                            )
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                tint = SukaOrange,
                                modifier = Modifier.size(12.dp)
                            )
                        }
                    }

                    // 2-Column Grid Best Seller Cards
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        bestSellerItems.take(2).forEachIndexed { index, item ->
                            val rank = index + 1
                            val rating = if (index == 0) "4.9" else "4.8"
                            val reviewCount = if (index == 0) "480+" else "320+"
                            Box(modifier = Modifier.weight(1f)) {
                                BestSellerCard(
                                    item = item,
                                    rank = rank,
                                    rating = rating,
                                    reviewCount = reviewCount,
                                    onKlik = onPilihItem
                                )
                            }
                        }
                    }
                }
            }
        }

        // 4. Secondary Media / Campaign Promotional Banner
        item(key = "home-secondary-banner") {
            SecondaryMediaBanner(
                onCekInfo = onBukaMenu
            )
        }

        // 5. Explore Full Menu Call-to-Action Card
        item(key = "home-explore-menu-cta") {
            ExploreMenuCtaCard(
                onBukaMenu = onBukaMenu
            )
        }
    }
}

/**
 * Multi-Slide Promo Media Carousel ala Stitch Design System -- isi slide
 * kini seluruhnya berasal dari banner gateway, bukan lagi data hardcoded.
 * Dipanggil hanya saat [slides] tidak kosong (lihat HomeContentList).
 */
@Composable
private fun PromoMediaCarousel(
    slides: List<BannerDto>,
    onKetuk: (BannerDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState(pageCount = { slides.size })

    // Auto advance slide secara berkala
    LaunchedEffect(pagerState, slides.size) {
        while (true) {
            delay(4500)
            if (!pagerState.isScrollInProgress && slides.size > 1) {
                val next = (pagerState.currentPage + 1) % slides.size
                pagerState.animateScrollToPage(next)
            }
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth()
        ) { page ->
            val slide = slides[page]
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .bounceClick(scaleDown = 0.98f) { onKetuk(slide) },
                shape = RoundedCornerShape(18.dp),
                color = SukaBrown,
                shadowElevation = 4.dp,
                border = BorderStroke(1.dp, Color(0xFF8A1D07).copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (!slide.badge.isNullOrBlank()) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SukaOrange)
                                    .padding(horizontal = 7.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = slide.badge,
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaInk,
                                        fontSize = 9.sp
                                    )
                                )
                            }
                        }

                        Text(
                            text = slide.judul,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFFFFF4EB),
                                fontSize = 15.sp,
                                lineHeight = 19.sp
                            )
                        )

                        if (!slide.subjudul.isNullOrBlank()) {
                            Text(
                                text = slide.subjudul,
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color(0xFFFFF4EB).copy(alpha = 0.85f),
                                    fontSize = 10.sp,
                                    lineHeight = 13.sp
                                ),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        Spacer(modifier = Modifier.height(1.dp))

                        Button(
                            onClick = { onKetuk(slide) },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 3.dp),
                            modifier = Modifier.bounceClick()
                        ) {
                            Text(
                                text = slide.teksTombol?.takeIf { it.isNotBlank() } ?: "Lihat",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 11.sp
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                modifier = Modifier.size(11.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(10.dp))

                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFF8A1D07))
                            .border(BorderStroke(1.5.dp, SukaOrange.copy(alpha = 0.5f)), RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (slide.gambarUrl != null) {
                            AsyncImage(
                                model = slide.gambarUrl,
                                contentDescription = slide.judul,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                }
            }
        }

        // Animated Pagination Dot Indicators
        Row(
            modifier = Modifier.padding(top = 4.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(slides.size) { index ->
                val isSelected = pagerState.currentPage == index
                val width by animateDpAsState(
                    targetValue = if (isSelected) 18.dp else 5.dp,
                    animationSpec = tween(durationMillis = 250),
                    label = "pagerDotWidth"
                )
                val dotColor by animateColorAsState(
                    targetValue = if (isSelected) SukaOrange else SukaBorder.copy(alpha = 0.8f),
                    animationSpec = tween(durationMillis = 250),
                    label = "pagerDotColor"
                )
                Box(
                    modifier = Modifier
                        .padding(horizontal = 2.dp)
                        .height(5.dp)
                        .width(width)
                        .clip(CircleShape)
                        .background(dotColor)
                )
            }
        }
    }
}

/**
 * Kartu Best Seller Vertikal Modern
 */
@Composable
private fun BestSellerCard(
    item: MenuItemDto,
    rank: Int,
    rating: String,
    reviewCount: String,
    onKlik: (MenuItemDto) -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        onClick = { onKlik(item) },
        modifier = modifier
            .fillMaxWidth()
            .bounceClick(scaleDown = 0.97f),
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 3.dp,
        border = BorderStroke(1.dp, SukaBorder)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(82.dp)
                    .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                    .background(SukaTint)
            ) {
                AsyncImage(
                    model = item.imageUrl ?: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-1VF8-8QaQcQ6cmXMurD2EvPHrP2j_cotf5LxDsJhsuHPuzbmNqUIielgYlF8F6zj-wa6sSNP2qdPHdpAkVGLwdkzt2_BoWryJbpIB1MPcnS5KC7Qnsur5QBCCh423OYZcFRPeAFQjjMueVERE8RO6POhDbXSkNX2DUnw82HsiYONuRZKXQbD0T6tbEiGGpqIqxxfRtTj4c0-JjhF44ih-HJwp52RRjdcrpTccNHx45kRZYTRG7iz8v5fQipfTNnWM96x1AEo0WuL",
                    contentDescription = item.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                // Rank Badge
                Box(
                    modifier = Modifier
                        .padding(6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(SukaBrown.copy(alpha = 0.88f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "Best Seller #$rank",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 8.sp
                        )
                    )
                }
            }

            Column(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Rating
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = "★ $rating",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaOrange,
                            fontSize = 9.sp
                        )
                    )
                    Text(
                        text = "($reviewCount)",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 9.sp
                        )
                    )
                }

                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SukaInk,
                        fontSize = 12.sp
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                item.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 9.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = rupiah(item.price.roundToLong()),
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaBrown,
                            fontSize = 12.sp
                        )
                    )

                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(SukaOrange),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "Tambah",
                            tint = SukaInk,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Secondary Media / Campaign Promotional Banner
 */
@Composable
private fun SecondaryMediaBanner(
    onCekInfo: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .bounceClick(scaleDown = 0.98f) { onCekInfo() },
        shape = RoundedCornerShape(18.dp),
        color = SukaBrown,
        shadowElevation = 4.dp,
        border = BorderStroke(1.dp, Color(0xFF8A1D07).copy(alpha = 0.6f))
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(SukaOrange.copy(alpha = 0.25f))
                        .padding(horizontal = 7.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "⭐ JAMINAN KUALITAS SUKA",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaOrange,
                            fontSize = 9.sp,
                            letterSpacing = 0.5.sp
                        )
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = "Kisah Rasa",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaOrange,
                            fontSize = 11.sp
                        )
                    )
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }

            Text(
                text = "100% Daging Segar & Rempah Asli Dipanggang",
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFFFFF4EB),
                    fontSize = 14.sp,
                    lineHeight = 18.sp
                )
            )

            Text(
                text = "Flatbread hangat & saus garlic toum otentik tanpa pengawet.",
                style = MaterialTheme.typography.bodySmall.copy(
                    color = Color(0xFFFFF4EB).copy(alpha = 0.85f),
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
            )
        }
    }
}

/**
 * Kartu Ajakan Jelajah Menu Penuh
 */
@Composable
private fun ExploreMenuCtaCard(
    onBukaMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .bounceClick(scaleDown = 0.98f) { onBukaMenu() },
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 2.dp,
        border = BorderStroke(1.dp, SukaBorder)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(SukaTint),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Filled.RestaurantMenu,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Column {
                    Text(
                        text = "Jelajahi Menu Lengkap",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaInk,
                            fontSize = 14.sp
                        )
                    )
                    Text(
                        text = "Pilih shawarma, kombo, & minuman",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 11.sp
                        )
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(SukaOrange)
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Buka Menu",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaInk,
                            fontSize = 11.sp
                        )
                    )
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = null,
                        tint = SukaInk,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
        }
    }
}
