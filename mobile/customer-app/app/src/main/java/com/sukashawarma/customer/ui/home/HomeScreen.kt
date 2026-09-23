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
import androidx.compose.foundation.layout.heightIn
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
import com.sukashawarma.customer.ui.components.PerluPilihOutletState
import com.sukashawarma.customer.ui.components.HomeBrandHeader
import com.sukashawarma.customer.ui.components.RangkaBeranda
import com.sukashawarma.customer.ui.components.OutletHeader
import com.sukashawarma.customer.ui.components.PromoPopupDialog
import com.sukashawarma.customer.ui.components.BannerCarousel
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
                state.memuat -> RangkaBeranda()

                state.tidakAdaOutlet -> EmptyState(
                    judul = "Belum ada outlet",
                    penjelasan = "Pemesanan lewat aplikasi belum dibuka di outlet mana pun. Coba lagi nanti."
                )

                state.perluPilihOutlet -> PerluPilihOutletState(onPilihOutlet = onGantiOutlet)

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
                BannerCarousel(
                    // Jarak dari lengkungan kepala halaman; tanpa ini banner
                    // yang mentok tepi menempel ke kartu outlet.
                    modifier = Modifier.padding(top = 12.dp),
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
                    verticalArrangement = Arrangement.spacedBy(8.dp)
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
                                    fontSize = 11.sp
                                )
                            )
                        }

                        Row(
                            modifier = Modifier
                                .heightIn(min = 48.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { onBukaMenu() }
                                .padding(horizontal = 8.dp),
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
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        bestSellerItems.take(2).forEachIndexed { index, item ->
                            val rank = index + 1
                            Box(modifier = Modifier.weight(1f)) {
                                BestSellerCard(
                                    item = item,
                                    rank = rank,
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
 * Kartu Best Seller Vertikal Modern
 */
@Composable
private fun BestSellerCard(
    item: MenuItemDto,
    rank: Int,
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
                // Sengaja tanpa fallback ke URL gambar mockup Stitch --
                // disamakan dengan CatalogScreen.kt. Menu tanpa foto cukup
                // tampil di atas latar SukaTint, bukan memakai foto menu lain
                // sebagai penggantinya.
                if (item.imageUrl != null) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                // Rank Badge
                Box(
                    modifier = Modifier
                        .padding(8.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(SukaBrown.copy(alpha = 0.88f))
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "Best Seller #$rank",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 11.sp
                        )
                    )
                }
            }

            Column(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Rating sengaja tidak ditampilkan: aplikasi belum punya
                // ulasan pelanggan, dan angka karangan menyesatkan.
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
                            fontSize = 11.sp
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

                    // Tombol sungguhan (dulu hanya hiasan tanpa aksi). Membuka
                    // detail menu, sama seperti "+" di MenuCard, karena topping
                    // & catatan dipilih di sana. Area sentuh 48dp, lingkaran 32dp.
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .bounceClick(scaleDown = 0.9f) { onKlik(item) },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(SukaOrange),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Add,
                                contentDescription = "Tambah " + item.name,
                                tint = SukaInk,
                                modifier = Modifier.size(18.dp)
                            )
                        }
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
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "⭐ JAMINAN KUALITAS SUKA",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaOrange,
                            fontSize = 11.sp,
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
                    .padding(horizontal = 12.dp, vertical = 8.dp)
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
