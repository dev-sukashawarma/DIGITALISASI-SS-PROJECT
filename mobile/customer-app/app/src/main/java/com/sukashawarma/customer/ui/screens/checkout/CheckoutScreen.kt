package com.sukashawarma.customer.ui.screens.checkout

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
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.CartProblemDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 9 - checkout dengan validasi pra-bayar.
 *
 * Angka yang ditampilkan seluruhnya berasal dari gateway. Aplikasi tidak
 * menghitung ulang total: satu-satunya angka yang boleh dilihat pelanggan
 * adalah angka yang akan benar-benar ditagihkan.
 */
@Composable
fun CheckoutScreen(
    viewModel: CheckoutViewModel,
    onKembali: () -> Unit,
    onBayar: () -> Unit,
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
                Text("Ringkasan pesanan", style = MaterialTheme.typography.headlineSmall)
            }

            when {
                state.keranjangKosong -> EmptyState(
                    judul = "Keranjang masih kosong",
                    penjelasan = "Pilih menu dari katalog untuk mulai memesan."
                )

                state.memuat -> MemuatState()

                state.galat != null -> ErrorState(
                    error = state.galat!!,
                    onCobaLagi = viewModel::validasi
                )

                else -> Isi(state = state, viewModel = viewModel, onBayar = onBayar)
            }
        }
    }
}

@Composable
private fun Isi(
    state: CheckoutState,
    viewModel: CheckoutViewModel,
    onBayar: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {

        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            state.pesanPenolakan?.let { pesan ->
                item(key = "penolakan") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                        color = SukaTint
                    ) {
                        Text(
                            pesan,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            items(state.masalah, key = { it.menuItemId + it.jenis }) { masalah ->
                KartuMasalah(masalah = masalah, onPerbaiki = { viewModel.perbaiki(masalah) })
            }

            if (state.masalah.size > 1) {
                item(key = "perbaiki-semua") {
                    OutlinedButton(
                        onClick = viewModel::perbaikiSemua,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Perbaiki semuanya")
                    }
                }
            }

            items(state.baris, key = { it.menuItemId + (it.catatan ?: "") }) { baris ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "${baris.jumlah}x ${baris.nama}",
                            style = MaterialTheme.typography.bodyLarge
                        )
                        if (!baris.catatan.isNullOrBlank()) {
                            Text(
                                baris.catatan,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    Text(
                        rupiah(baris.hargaSatuan * baris.jumlah),
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }
        }

        HorizontalDivider()

        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Baris uang hanya muncul kalau gateway benar-benar mengirimnya.
            // Menampilkan angka hasil hitungan sendiri saat validasi menolak
            // akan memamerkan total untuk pesanan yang tidak bisa dibayar.
            state.subtotal?.let { BarisUang("Subtotal", it) }
            state.potongan?.takeIf { it > 0 }?.let { BarisUang("Potongan", -it) }
            state.total?.let {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Total", style = MaterialTheme.typography.titleMedium)
                    Text(rupiah(it), style = MaterialTheme.typography.headlineSmall)
                }
            }

            Text(
                "Pesanan diambil sendiri di outlet. Tidak ada pengantaran.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Button(
                onClick = onBayar,
                modifier = Modifier.fillMaxWidth(),
                enabled = state.bolehLanjut
            ) {
                Text(if (state.bolehLanjut) "Bayar sekarang" else "Belum bisa dibayar")
            }
        }
    }
}

@Composable
private fun BarisUang(label: String, nilai: Long) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(rupiah(nilai), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun KartuMasalah(masalah: CartProblemDto, onPerbaiki: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                pesanUntukMasalah(masalah),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f)
            )
            OutlinedButton(onClick = onPerbaiki) { Text(labelTindakan(masalah)) }
        }
    }
}
