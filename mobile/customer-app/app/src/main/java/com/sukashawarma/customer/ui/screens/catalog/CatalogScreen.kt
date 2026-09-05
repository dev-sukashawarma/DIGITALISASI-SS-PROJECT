package com.sukashawarma.customer.ui.screens.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.screens.closed.OutletClosedScreen
import com.sukashawarma.customer.ui.theme.SukaTint

@Composable
fun CatalogScreen(
    viewModel: CatalogViewModel,
    porsiKeranjang: Int,
    subtotalKeranjang: Long,
    onGantiOutlet: () -> Unit,
    onPilihItem: (MenuItemDto) -> Unit,
    onBukaKeranjang: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            // Bilah keranjang hanya muncul kalau ada isinya. Bilah kosong yang
            // selalu nongkrong memakan ruang layar tanpa menawarkan apa pun.
            if (porsiKeranjang > 0) {
                BilahKeranjang(
                    porsi = porsiKeranjang,
                    subtotal = subtotalKeranjang,
                    onKlik = onBukaKeranjang
                )
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

            state.outlet?.let {
                OutletHeader(
                    namaOutlet = it.name,
                    buka = it.isActive,
                    onGantiOutlet = onGantiOutlet
                )
            }

            if (state.keranjangDikosongkan) {
                SpandukKeranjangDikosongkan(onTutup = viewModel::akuiKeranjangDikosongkan)
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
private fun SpandukKeranjangDikosongkan(onTutup: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        shape = MaterialTheme.shapes.small,
        color = SukaTint
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Keranjang dikosongkan karena kamu berpindah outlet. " +
                    "Menu tiap outlet berbeda.",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f)
            )
            TextButton(onClick = onTutup) { Text("Mengerti") }
        }
    }
}

@Composable
private fun BilahKeranjang(porsi: Int, subtotal: Long, onKlik: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Button(
            onClick = onKlik,
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("$porsi porsi")
                Text(rupiah(subtotal))
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
