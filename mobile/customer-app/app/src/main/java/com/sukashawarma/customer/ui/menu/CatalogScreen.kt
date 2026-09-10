package com.sukashawarma.customer.ui.menu

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.MenuCard
import com.sukashawarma.customer.ui.components.BottomNavTab
import com.sukashawarma.customer.ui.components.OutletHeader
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.home.OutletClosedScreen
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint
import kotlin.math.roundToLong
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun CatalogScreen(
    viewModel: CatalogViewModel,
    porsiKeranjang: Int,
    subtotalKeranjang: Long,
    onGantiOutlet: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    onBukaKeranjang: () -> Unit,
    onBukaRiwayat: () -> Unit,
    onBukaProfil: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var selectedCategoryName by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.eventScroll.collect { event ->
            when (event) {
                CatalogScrollEvent.KeAtas -> {
                    selectedCategoryName = null
                    listState.animateScrollToItem(0)
                }
                CatalogScrollEvent.KeMenu -> {
                    listState.animateScrollToItem(if (state.kueri.isBlank()) 4 else 0)
                }
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

            // Header Outlet & Status
            state.outlet?.let {
                OutletHeader(
                    namaOutlet = it.name,
                    buka = it.isActive,
                    onGantiOutlet = onGantiOutlet,
                    onBukaProfil = onBukaProfil
                )
            }

            if (state.keranjangDikosongkan) {
                SpandukKeranjangDikosongkan(onTutup = viewModel::akuiKeranjangDikosongkan)
            }

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
                    // Filter kategori jika ada kategori yang dipilih
                    val filteredKategori = if (selectedCategoryName == null) {
                        state.kategori
                    } else {
                        state.kategori.filter { it.nama.equals(selectedCategoryName, ignoreCase = true) }
                    }

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

                    CatalogContentList(
                        state = state,
                        filteredKategori = filteredKategori,
                        bestSellerItems = bestSellerItems,
                        selectedCategory = selectedCategoryName,
                        onSelectCategory = { selectedCategoryName = it },
                        onUbahKueri = viewModel::ubahKueri,
                        onPilihItem = onPilihItem,
                        onLihatSemuaMenu = {
                            selectedCategoryName = null
                            viewModel.setTab(BottomNavTab.MENU)
                        },
                        listState = listState
                    )
                }
            }
        }
    }
}

/**
 * Daftar Konten Katalog dengan Carousel Promosi, Best Seller, Banner Sekunder, dan Menu
 */
@Composable
private fun CatalogContentList(
    state: CatalogState,
    filteredKategori: List<KategoriMenu>,
    bestSellerItems: List<MenuItemDto>,
    selectedCategory: String?,
    onSelectCategory: (String?) -> Unit,
    onUbahKueri: (String) -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    onLihatSemuaMenu: () -> Unit,
    listState: androidx.compose.foundation.lazy.LazyListState
) {
    val coroutineScope = rememberCoroutineScope()

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(bottom = 90.dp)
    ) {
        // 1. Search Bar Pill
        item(key = "search-bar") {
            Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)) {
                OutlinedTextField(
                    value = state.kueri,
                    onValueChange = onUbahKueri,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = {
                        Text(
                            "Cari menu favoritmu, shawarma, sapi, minuman...",
                            fontSize = 13.sp,
                            color = SukaMuted
                        )
                    },
                    leadingIcon = {
                        Icon(Icons.Filled.Search, contentDescription = null, tint = SukaMuted)
                    },
                    trailingIcon = {
                        if (state.kueri.isNotBlank()) {
                            IconButton(onClick = { onUbahKueri("") }) {
                                Icon(Icons.Filled.Close, contentDescription = "Hapus", tint = SukaMuted)
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .padding(end = 6.dp)
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(Color.White)
                                    .border(BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f)), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.Tune,
                                    contentDescription = "Filter",
                                    tint = SukaBrown,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(24.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SukaTint,
                        unfocusedContainerColor = SukaTint,
                        focusedBorderColor = SukaOrange,
                        unfocusedBorderColor = SukaBorder.copy(alpha = 0.7f),
                        cursorColor = SukaOrange
                    )
                )
            }
        }

        // Tampilan Promosi & Best Seller hanya aktif ketika tidak sedang mencari teks tertentu
        if (state.kueri.isBlank()) {
            // 2. Multi-Slide Promo Media Carousel
            item(key = "promo-media-carousel") {
                PromoMediaCarousel(
                    firstItem = state.semuaItem.firstOrNull { it.isAvailable },
                    onPesanSekarang = { item ->
                        if (item != null) onPilihItem(item)
                    }
                )
            }

            // 3. Section Menu Terlaris (Best Seller)
            if (bestSellerItems.isNotEmpty()) {
                item(key = "best-sellers-section") {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Section Header
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "🔥 Menu Terlaris (Best Seller)",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaInk,
                                        fontSize = 16.sp
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
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { onLihatSemuaMenu() }
                                    .padding(vertical = 4.dp, horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Text(
                                    text = "Lihat Semua",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SukaOrange,
                                        fontSize = 12.sp
                                    )
                                )
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = null,
                                    tint = SukaOrange,
                                    modifier = Modifier.size(13.dp)
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
                            bestSellerItems.take(2).forEachIndexed { idx, item ->
                                Box(modifier = Modifier.weight(1f)) {
                                    BestSellerCard(
                                        item = item,
                                        rank = idx + 1,
                                        rating = if (idx == 0) "4.9" else "4.8",
                                        reviewCount = if (idx == 0) "480+" else "320+",
                                        onKlik = onPilihItem
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 4. Secondary Media / Campaign Promotional Banner
            item(key = "secondary-campaign-banner") {
                SecondaryMediaBanner(
                    onCekInfo = {
                        coroutineScope.launch {
                            listState.animateScrollToItem(4)
                        }
                    }
                )
            }

            // 5. Category Chips Row
            if (state.kategori.isNotEmpty()) {
                item(key = "category-chips") {
                    CategoryChipsRow(
                        kategoriList = state.kategori.map { it.nama },
                        selectedCategory = selectedCategory,
                        onSelectCategory = onSelectCategory
                    )
                }
            }
        }

        // 6. Content State: Kosong atau Daftar Seluruh Menu
        if (filteredKategori.isEmpty()) {
            item(key = "empty-search") {
                Box(modifier = Modifier.padding(16.dp)) {
                    if (state.kueri.isBlank()) {
                        EmptyState(
                            judul = "Menu belum terbit",
                            penjelasan = "Outlet ini belum menerbitkan menu ke aplikasi."
                        )
                    } else {
                        EmptyState(
                            judul = "Tidak ditemukan",
                            penjelasan = "Tidak ada menu yang cocok dengan \"${state.kueri}\"."
                        )
                    }
                }
            }
        } else {
            filteredKategori.forEach { kategori ->
                item(key = "judul-${kategori.id ?: kategori.nama}") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = kategori.nama,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaInk,
                                fontSize = 17.sp
                            )
                        )
                        Text(
                            text = "${kategori.items.size} pilihan",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = SukaMuted,
                                fontSize = 11.sp
                            )
                        )
                    }
                }

                items(kategori.items, key = { it.id }) { menu ->
                    Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                        MenuCard(item = menu, onKlik = onPilihItem)
                    }
                }
            }
        }
    }
}

/**
 * Slide Promosi Media Data
 */
private data class PromoSlideItem(
    val badge: String,
    val judul: String,
    val subjudul: String,
    val ctaText: String,
    val imageUrl: String
)

private val promoSlideItems = listOf(
    PromoSlideItem(
        badge = "🔥 Promo Spesial",
        judul = "Shawarma Lagi Ngidam?",
        subjudul = "Fresh, juicy, dan dipanggang saat kamu pesan.",
        ctaText = "Pesan Sekarang",
        imageUrl = "https://lh3.googleusercontent.com/aida-public/AB6AXuA-1VF8-8QaQcQ6cmXMurD2EvPHrP2j_cotf5LxDsJhsuHPuzbmNqUIielgYlF8F6zj-wa6sSNP2qdPHdpAkVGLwdkzt2_BoWryJbpIB1MPcnS5KC7Qnsur5QBCCh423OYZcFRPeAFQjjMueVERE8RO6POhDbXSkNX2DUnw82HsiYONuRZKXQbD0T6tbEiGGpqIqxxfRtTj4c0-JjhF44ih-HJwp52RRjdcrpTccNHx45kRZYTRG7iz8v5fQipfTNnWM96x1AEo0WuL"
    ),
    PromoSlideItem(
        badge = "✨ Paket Kombo Sultan",
        judul = "Hemat s.d. 30%",
        subjudul = "Shawarma + Fries + Es Lemon Tea dingin segar.",
        ctaText = "Klaim Promo",
        imageUrl = "https://lh3.googleusercontent.com/aida/AEtjO1WGc7yXsTH7Q2HiHhro3ZHWeMVWyE5rOeLoQKeery539b8tulI15hljKMSvv_dRRAUS7nPC8hCSMXLO21eEK_pxMQcbs54lQ9m8jZZPS7pLmWzmb8citeQCQqIMdOfKKhyIt9rpgbxfuya9pxh11vlvd3pMSculTWpBdknLFf2gapvIzGgwplnroB9B9KenbhxcsEGUoVR2riL5nQwxHoe-zVOQX0k7lKXXM9Nz1i1d3YAh9vk-XRChk35y"
    ),
    PromoSlideItem(
        badge = "🎉 Diskon Pengguna Baru",
        judul = "Voucher Diskon 40%",
        subjudul = "Gunakan kode SUKABARU di checkout.",
        ctaText = "Pakai Voucher",
        imageUrl = "https://lh3.googleusercontent.com/aida/AEtjO1V6KGbjlTCABYuMcaZfjUrt7zn4C9O5kPi2gwnI3ZOPrIVQy6486w3nunqhyNCB6qT14P-ALcS4DdvrG_0QfrhUuS2k_JwmGndB3o9hcx9ytJI56yZcBElo2JMpRxL1pb07SVyRfbnBsjTG4wytDd-lRu-768oa3AGhnuFFplsHGJ8uT_1zPAf6tM5f4YHp4Hp0pp_p0QKrdFTCmdX2f3u8QuGooSTRKFvBidF68TkE0pCP8M7Wai_wl_Dg"
    )
)

/**
 * Multi-Slide Promo Media Carousel ala Stitch Design System
 */
@Composable
private fun PromoMediaCarousel(
    firstItem: MenuItemDto?,
    onPesanSekarang: (MenuItemDto?) -> Unit,
    modifier: Modifier = Modifier
) {
    val pagerState = rememberPagerState(pageCount = { promoSlideItems.size })

    // Auto advance slide secara berkala
    LaunchedEffect(pagerState) {
        while (true) {
            delay(4500)
            if (!pagerState.isScrollInProgress) {
                val next = (pagerState.currentPage + 1) % promoSlideItems.size
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
            val slide = promoSlideItems[page]
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(24.dp),
                color = SukaBrown,
                shadowElevation = 6.dp,
                border = BorderStroke(1.dp, Color(0xFF8A1D07).copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier.padding(18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(SukaOrange)
                                .padding(horizontal = 8.dp, vertical = 3.dp)
                        ) {
                            Text(
                                text = slide.badge,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 10.sp
                                )
                            )
                        }

                        Text(
                            text = slide.judul,
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFFFFF4EB),
                                fontSize = 17.sp,
                                lineHeight = 22.sp
                            )
                        )

                        Text(
                            text = slide.subjudul,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color(0xFFFFF4EB).copy(alpha = 0.85f),
                                fontSize = 11.sp,
                                lineHeight = 15.sp
                            )
                        )

                        Spacer(modifier = Modifier.height(2.dp))

                        Button(
                            onClick = { onPesanSekarang(firstItem) },
                            shape = RoundedCornerShape(16.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk
                            ),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                            modifier = Modifier.bounceClick()
                        ) {
                            Text(
                                text = slide.ctaText,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = null,
                                modifier = Modifier.size(13.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    Box(
                        modifier = Modifier
                            .size(105.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0xFF8A1D07))
                            .border(BorderStroke(2.dp, SukaOrange.copy(alpha = 0.5f)), RoundedCornerShape(18.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        AsyncImage(
                            model = slide.imageUrl,
                            contentDescription = slide.judul,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }
        }

        // Animated Pagination Dot Indicators
        Row(
            modifier = Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(promoSlideItems.size) { index ->
                val isSelected = pagerState.currentPage == index
                val width by animateDpAsState(
                    targetValue = if (isSelected) 22.dp else 6.dp,
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
                        .padding(horizontal = 3.dp)
                        .height(6.dp)
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
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 3.dp,
        border = BorderStroke(1.dp, SukaBorder)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(115.dp)
                    .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
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
                        .padding(8.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(SukaBrown.copy(alpha = 0.88f))
                        .padding(horizontal = 7.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "Best Seller #$rank",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 9.sp
                        )
                    )
                }
            }

            Column(
                modifier = Modifier.padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                // Rating
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Text(
                        text = "★ $rating",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaOrange,
                            fontSize = 10.sp
                        )
                    )
                    Text(
                        text = "($reviewCount)",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 10.sp
                        )
                    )
                }

                Text(
                    text = item.name,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SukaInk,
                        fontSize = 13.sp
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                item.description?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 10.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

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
                            fontSize = 13.sp
                        )
                    )

                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(SukaOrange),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Add,
                            contentDescription = "Tambah",
                            tint = SukaInk,
                            modifier = Modifier.size(16.dp)
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
        shape = RoundedCornerShape(22.dp),
        color = SukaBrown,
        shadowElevation = 5.dp,
        border = BorderStroke(1.dp, Color(0xFF8A1D07).copy(alpha = 0.6f))
    ) {
        Box {
            Column(
                modifier = Modifier.padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(SukaOrange.copy(alpha = 0.25f))
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = "⭐ JAMINAN KUALITAS SUKA SHAWARMA",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaOrange,
                            fontSize = 9.sp,
                            letterSpacing = 0.5.sp
                        )
                    )
                }

                Text(
                    text = "100% Daging Segar & Rempah Asli Dipanggang Setiap Hari",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFFFFF4EB),
                        fontSize = 15.sp,
                        lineHeight = 20.sp
                    )
                )

                Text(
                    text = "Dibuat dengan flatbread hangat & saus garlic toum racikan otentik timur tengah tanpa pengawet.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = Color(0xFFFFF4EB).copy(alpha = 0.85f),
                        fontSize = 11.sp,
                        lineHeight = 15.sp
                    )
                )

                Spacer(modifier = Modifier.height(4.dp))

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(SukaOrange)
                        .padding(horizontal = 14.dp, vertical = 7.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "Pelajari Kisah Rasa",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaInk,
                                fontSize = 11.sp
                            )
                        )
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = SukaInk,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Category Chips Horizontal Row
 */
@Composable
private fun CategoryChipsRow(
    kategoriList: List<String>,
    selectedCategory: String?,
    onSelectCategory: (String?) -> Unit
) {
    val items = listOf("Semua") + kategoriList

    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(items) { nama ->
            val isSelected = (nama == "Semua" && selectedCategory == null) ||
                (nama == selectedCategory)

            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .clickable {
                        onSelectCategory(if (nama == "Semua") null else nama)
                    },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) SukaOrange else Color.White,
                border = BorderStroke(1.dp, if (isSelected) SukaOrange else SukaBorder),
                shadowElevation = if (isSelected) 3.dp else 1.dp
            ) {
                Text(
                    text = nama,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                        color = if (isSelected) Color.White else SukaInk,
                        fontSize = 12.sp
                    )
                )
            }
        }
    }
}

@Composable
private fun SpandukKeranjangDikosongkan(onTutup: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(12.dp),
        color = SukaTint,
        border = BorderStroke(1.dp, SukaBorder)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Keranjang dikosongkan karena kamu berpindah outlet. Menu tiap outlet berbeda.",
                style = MaterialTheme.typography.bodySmall.copy(fontSize = 12.sp, color = SukaInk),
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onTutup) {
                Text("Mengerti", fontWeight = FontWeight.Bold, color = SukaBrown)
            }
        }
    }
}
