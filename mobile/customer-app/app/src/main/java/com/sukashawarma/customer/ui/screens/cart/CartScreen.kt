package com.sukashawarma.customer.ui.screens.cart

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.format.rupiah

/**
 * Layar 8 - keranjang.
 *
 * Yang ditampilkan di sini adalah subtotal, BUKAN total yang akan ditagih.
 * Potongan dihitung gateway saat checkout (`hitungTotal`), dan menebaknya di
 * sini berisiko menampilkan angka yang berbeda dari yang benar-benar dibayar.
 */
@Composable
fun CartScreen(
    viewModel: CartViewModel,
    onKembali: () -> Unit,
    onLanjutBayar: () -> Unit,
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
                Text("Keranjang", style = MaterialTheme.typography.headlineSmall)
            }

            if (state.baris.isEmpty()) {
                EmptyState(
                    judul = "Keranjang masih kosong",
                    penjelasan = "Pilih menu dari katalog untuk mulai memesan."
                )
                return@Column
            }

            LazyColumn(
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                itemsIndexed(state.baris) { index, baris ->
                    BarisKeranjang(
                        baris = baris,
                        onKurang = { viewModel.ubahJumlah(index, -1) },
                        onTambah = { viewModel.ubahJumlah(index, 1) }
                    )
                }
            }

            HorizontalDivider()

            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Subtotal", style = MaterialTheme.typography.titleMedium)
                    Text(rupiah(state.subtotal), style = MaterialTheme.typography.titleLarge)
                }
                Text(
                    "Potongan dan total akhir dihitung saat pembayaran.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Button(
                    onClick = onLanjutBayar,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Lanjut ke pembayaran")
                }
            }
        }
    }
}

@Composable
private fun BarisKeranjang(
    baris: CartLine,
    onKurang: () -> Unit,
    onTambah: () -> Unit
) {
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
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    baris.nama,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (!baris.catatan.isNullOrBlank()) {
                    Text(
                        baris.catatan,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    rupiah(baris.hargaSatuan * baris.jumlah),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            // Tombol kurang pada jumlah 1 MENGHAPUS baris, dan itu disengaja:
            // itulah satu-satunya cara membuang item dari keranjang di layar
            // ini. Labelnya berubah supaya perbuatannya tidak mengejutkan.
            OutlinedButton(onClick = onKurang) {
                Text(if (baris.jumlah <= 1) "Hapus" else "-")
            }
            Text(baris.jumlah.toString(), style = MaterialTheme.typography.titleLarge)
            OutlinedButton(onClick = onTambah) { Text("+") }
        }
    }
}
