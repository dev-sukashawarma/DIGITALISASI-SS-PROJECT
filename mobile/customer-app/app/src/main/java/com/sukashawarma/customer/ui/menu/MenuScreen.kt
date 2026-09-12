package com.sukashawarma.customer.ui.menu

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
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
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.MenuBrandHeader
import com.sukashawarma.customer.ui.components.MenuCard
import com.sukashawarma.customer.ui.home.OutletClosedScreen
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

@Composable
fun MenuScreen(
    viewModel: CatalogViewModel,
    onGantiOutlet: () -> Unit,
    onBukaProfil: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val categoryRowState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()

    // 1. Indeks tiap judul kategori di LazyColumn
    val categoryHeaderIndices = remember(state.kategori) {
        val indices = mutableListOf<Int>()
        var currentIndex = 0
        state.kategori.forEach { kat ->
            indices.add(currentIndex)
            currentIndex += 1 + kat.items.size // 1 item judul + N menu cards
        }
        indices
    }

    // 2. Scroll-Spy: Deteksi kategori mana yang saat ini sedang aktif di layar atas
    val activeCategoryIndex by remember(state.kategori, categoryHeaderIndices) {
        derivedStateOf {
            if (state.kategori.isEmpty()) return@derivedStateOf 0
            val layoutInfo = listState.layoutInfo
            val lastVisible = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            if (layoutInfo.totalItemsCount > 0 && lastVisible == layoutInfo.totalItemsCount - 1 && !listState.canScrollForward) {
                return@derivedStateOf state.kategori.size - 1
            }
            val firstVisible = listState.firstVisibleItemIndex
            var active = 0
            for (i in categoryHeaderIndices.indices) {
                if (categoryHeaderIndices[i] <= firstVisible) {
                    active = i
                } else {
                    break
                }
            }
            active.coerceIn(0, state.kategori.size - 1)
        }
    }

    // 3. Auto-scroll baris chip kategori saat kategori aktif berpindah
    LaunchedEffect(activeCategoryIndex) {
        if (state.kategori.isNotEmpty() && activeCategoryIndex in state.kategori.indices) {
            categoryRowState.animateScrollToItem(activeCategoryIndex)
        }
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
            // Header Brand Menu, Search Box & Kategori Terintegrasi (Menyatu dalam Header)
            state.outlet?.let {
                MenuBrandHeader(
                    namaOutlet = it.name,
                    buka = it.isActive,
                    kueriPencarian = state.kueri,
                    onUbahKueri = viewModel::ubahKueri,
                    onGantiOutlet = onGantiOutlet,
                    onBukaProfil = onBukaProfil,
                    kategoriContent = if (state.kategori.isNotEmpty() && !state.memuat && state.galat == null) {
                        {
                            CategoryChipsRow(
                                kategoriList = state.kategori.map { kat -> kat.nama },
                                activeIndex = activeCategoryIndex,
                                rowState = categoryRowState,
                                onSelectCategory = { targetCatIndex ->
                                    val targetHeaderIndex = categoryHeaderIndices.getOrNull(targetCatIndex) ?: 0
                                    coroutineScope.launch {
                                        listState.animateScrollToItem(targetHeaderIndex)
                                    }
                                }
                            )
                        }
                    } else null
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
                    MenuCatalogContent(
                        state = state,
                        listState = listState,
                        onPilihItem = onPilihItem
                    )
                }
            }
        }
    }
}

@Composable
private fun MenuCatalogContent(
    state: CatalogState,
    listState: LazyListState,
    onPilihItem: (MenuItemDto) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 80.dp)
    ) {
        if (state.kategori.isEmpty()) {
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
            state.kategori.forEach { kategori ->
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
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaInk,
                                fontSize = 16.sp
                            )
                        )
                        Text(
                            text = "${kategori.items.size} pilihan",
                            style = MaterialTheme.typography.bodySmall.copy(
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
 * Category Chips Horizontal Row - Terintegrasi di dalam MenuBrandHeader
 */
@Composable
private fun CategoryChipsRow(
    kategoriList: List<String>,
    activeIndex: Int,
    rowState: LazyListState,
    onSelectCategory: (Int) -> Unit
) {
    LazyRow(
        state = rowState,
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        itemsIndexed(kategoriList) { index, nama ->
            val isSelected = (index == activeIndex)

            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .clickable { onSelectCategory(index) },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) SukaOrange else Color.White.copy(alpha = 0.18f),
                border = BorderStroke(
                    1.dp,
                    if (isSelected) SukaOrange else Color.White.copy(alpha = 0.28f)
                ),
                shadowElevation = if (isSelected) 3.dp else 0.dp
            ) {
                Text(
                    text = nama,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                        color = if (isSelected) SukaInk else Color(0xFFFFF4EB),
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
