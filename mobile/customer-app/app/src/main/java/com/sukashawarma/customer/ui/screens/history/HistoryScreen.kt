package com.sukashawarma.customer.ui.screens.history

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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.OrderDetailDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.screens.status.tampilanStatus

/**
 * Layar 14 - riwayat pesanan.
 *
 * **Tidak ada tombol "Pesan Lagi" di versi ini.** Rencana memintanya, dan ia
 * memang berguna -- tapi mengisi ulang keranjang butuh `menu_item_id` dan
 * harga tiap baris, sedangkan `/api/v1/orders/list` hanya mengembalikan
 * ringkasan pesanan (nomor, total, status, outlet), tanpa rincian itemnya.
 * Menebak isinya dari nama menu akan meleset begitu menu berganti nama, dan
 * meleset di keranjang berarti pelanggan membayar sesuatu yang tidak ia pilih.
 *
 * Membangunnya dengan benar butuh gateway mengembalikan `items` per pesanan.
 * Itu perubahan aditif yang kecil, tapi di luar lingkup task ini.
 */
@Composable
fun HistoryScreen(
    viewModel: HistoryViewModel,
    onBukaPesanan: (String) -> Unit,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onKembali) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali")
                }
                Text("Riwayat pesanan", style = MaterialTheme.typography.headlineSmall)
            }

            when {
                state.memuat -> MemuatState()

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                state.pesanan.isEmpty() -> EmptyState(
                    judul = "Belum ada pesanan",
                    penjelasan = "Pesanan yang sudah kamu bayar akan muncul di sini."
                )

                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(state.pesanan, key = { it.id }) { pesanan ->
                        BarisRiwayat(pesanan = pesanan, onKlik = { onBukaPesanan(pesanan.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun BarisRiwayat(pesanan: OrderDetailDto, onKlik: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable { onKlik() },
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
                    pesanan.posOrderNumber?.let { "Pesanan #$it" } ?: "Pesanan",
                    style = MaterialTheme.typography.titleMedium
                )
                pesanan.outletName?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Text(
                    tampilanStatus(pesanan.statusDapur).judul,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(rupiah(pesanan.totalAmount), style = MaterialTheme.typography.titleMedium)
        }
    }
}
