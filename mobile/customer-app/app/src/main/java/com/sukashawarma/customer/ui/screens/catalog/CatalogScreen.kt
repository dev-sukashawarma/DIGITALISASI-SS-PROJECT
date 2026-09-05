package com.sukashawarma.customer.ui.screens.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.MenuCard
import com.sukashawarma.customer.ui.components.OutletHeader
import com.sukashawarma.customer.ui.screens.closed.OutletClosedScreen

@Composable
fun CatalogScreen(
    viewModel: CatalogViewModel,
    onGantiOutlet: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

            state.outlet?.let {
                OutletHeader(
                    namaOutlet = it.name,
                    buka = it.isActive,
                    onGantiOutlet = onGantiOutlet
                )
            }

            when {
                state.memuat -> MemuatState()

                state.tidakAdaOutlet -> EmptyState(
                    judul = "Belum ada outlet",
                    penjelasan = "Pemesanan lewat aplikasi belum dibuka di outlet mana pun. " +
                        "Coba lagi nanti."
                )

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                state.outlet != null && !state.outlet!!.isActive -> OutletClosedScreen(
                    namaOutlet = state.outlet!!.name,
                    onGantiOutlet = onGantiOutlet
                )

                else -> DaftarMenu(
                    state = state,
                    onUbahKueri = viewModel::ubahKueri,
                    onPilihItem = onPilihItem
                )
            }
        }
    }
}

@Composable
private fun DaftarMenu(
    state: CatalogState,
    onUbahKueri: (String) -> Unit,
    onPilihItem: (MenuItemDto) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.kueri,
            onValueChange = onUbahKueri,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            placeholder = { Text("Cari shawarma, kebab, minuman") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            singleLine = true,
            shape = MaterialTheme.shapes.small
        )

        if (state.kategori.isEmpty()) {
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
            return
        }

        // Judul kelompok hanya berguna kalau ada lebih dari satu kelompok.
        // Satu judul tunggal di atas seluruh daftar cuma memakan ruang.
        val tampilkanJudul = state.kategori.size > 1

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            state.kategori.forEach { kategori ->
                if (tampilkanJudul) {
                    item(key = "judul-${kategori.id ?: "lainnya"}") {
                        Text(
                            kategori.nama,
                            style = MaterialTheme.typography.titleLarge,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
                items(kategori.items, key = { it.id }) { menu ->
                    MenuCard(item = menu, onKlik = onPilihItem)
                }
            }
        }
    }
}
