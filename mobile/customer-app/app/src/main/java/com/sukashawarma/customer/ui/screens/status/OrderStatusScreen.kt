package com.sukashawarma.customer.ui.screens.status

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaTint

@Composable
fun OrderStatusScreen(
    viewModel: OrderStatusViewModel,
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
                Text("Status pesanan", style = MaterialTheme.typography.headlineSmall)
            }

            val pesanan = state.pesanan
            when {
                state.memuat && pesanan == null -> MemuatState()

                // Data lama tetap ditampilkan saat penyegaran gagal. Pelanggan
                // yang berdiri di depan kasir tidak boleh kehilangan nomor
                // pesanannya hanya karena sinyal putus sedetik.
                pesanan == null && state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::muat
                )

                pesanan != null -> {
                    val tampil = tampilanStatus(pesanan.statusDapur)

                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = MaterialTheme.shapes.medium,
                            color = SukaTint
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "Nomor pesanan",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    pesanan.posOrderNumber?.toString() ?: "-",
                                    style = MaterialTheme.typography.headlineLarge
                                )
                                pesanan.outletName?.let {
                                    Text(it, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }

                        Text(tampil.judul, style = MaterialTheme.typography.headlineSmall)
                        Text(
                            tampil.penjelasan,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (!tampil.dibatalkan) {
                            Tahap("Diterima", tahapTercapai(tampil.tahap, TahapPesanan.DITERIMA))
                            Tahap("Sedang dibuat", tahapTercapai(tampil.tahap, TahapPesanan.DIBUAT))
                            Tahap("Siap diambil", tahapTercapai(tampil.tahap, TahapPesanan.SIAP))
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Total dibayar", style = MaterialTheme.typography.titleMedium)
                            Text(
                                rupiah(pesanan.totalAmount),
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Tahap(label: String, tercapai: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            if (tercapai) "\u2022" else "\u25CB",
            style = MaterialTheme.typography.titleLarge,
            color = if (tercapai) SukaGreen else MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            label,
            style = MaterialTheme.typography.bodyLarge,
            color = if (tercapai) {
                MaterialTheme.colorScheme.onSurface
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            }
        )
    }
}
