package com.sukashawarma.customer.ui.screens.outlet

import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.OutletDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.theme.SukaGreen

@Composable
fun OutletPickerScreen(
    viewModel: OutletPickerViewModel,
    onPilih: (OutletDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            Text(
                "Pilih Outlet",
                style = MaterialTheme.typography.headlineMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
            )

            OutlinedTextField(
                value = state.kueri,
                onValueChange = viewModel::ubahKueri,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                placeholder = { Text("Cari nama outlet atau area") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                shape = MaterialTheme.shapes.small
            )

            when {
                state.memuat -> MemuatState()

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                state.tampil.isEmpty() && state.kueri.isNotBlank() -> EmptyState(
                    judul = "Tidak ditemukan",
                    penjelasan = "Tidak ada outlet yang cocok dengan \"${state.kueri}\"."
                )

                state.tampil.isEmpty() -> EmptyState(
                    judul = "Belum ada outlet",
                    penjelasan = "Pemesanan lewat aplikasi belum dibuka di outlet mana pun."
                )

                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(state.tampil, key = { it.id }) { outlet ->
                        BarisOutlet(outlet = outlet, onPilih = onPilih)
                    }
                }
            }
        }
    }
}

/**
 * Outlet yang belum buka TETAP bisa dipilih — pelanggan boleh melihat menunya
 * dan menyiapkan keranjang lebih dulu. Layar "Outlet Belum Buka" yang menahan
 * pembayaran, bukan daftar ini.
 */
@Composable
private fun BarisOutlet(
    outlet: OutletDto,
    onPilih: (OutletDto) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable { onPilih(outlet) },
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    outlet.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!outlet.address.isNullOrBlank()) {
                    Text(
                        outlet.address,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            Text(
                if (outlet.isActive) "Buka" else "Belum buka",
                style = MaterialTheme.typography.labelMedium,
                color = if (outlet.isActive) SukaGreen else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
