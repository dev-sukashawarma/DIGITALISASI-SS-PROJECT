package com.sukashawarma.customer.ui.screens.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.PANJANG_MAKS_CATATAN
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Layar 7 - detail satu item.
 *
 * **Tidak ada bagian "Tambahan" (Extra Keju / Extra Kentang) walaupun ada di
 * artboard.** Gateway membandingkan `unit_price` dengan katalog memakai
 * kesamaan PERSIS (`validateCart.ts`), jadi harga yang dinaikkan oleh tambahan
 * akan ditolak sebagai `harga_berubah` tepat di titik pembayaran. Menuliskan
 * tambahan hanya di catatan justru lebih buruk: dapur membuatkannya, kasir
 * tidak pernah menagihnya. Tambahan baru bisa dibangun setelah ia punya baris
 * menunya sendiri di katalog, atau setelah gateway mendukung `package_choices`.
 */
@Composable
fun ItemDetailScreen(
    item: MenuItemDto,
    viewModel: ItemDetailViewModel,
    onKembali: () -> Unit,
    onTambahKeKeranjang: (jumlah: Int, catatan: String?) -> Unit,
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
                Text("Detail menu", style = MaterialTheme.typography.titleMedium)
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .background(SukaTint, MaterialTheme.shapes.medium),
                    contentAlignment = Alignment.Center
                ) {
                    if (item.imageUrl != null) {
                        AsyncImage(
                            model = item.imageUrl,
                            contentDescription = item.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                Text(item.name, style = MaterialTheme.typography.headlineSmall)

                if (!item.description.isNullOrBlank()) {
                    Text(
                        item.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(rupiah(item.price), style = MaterialTheme.typography.headlineMedium)

                Text("Catatan untuk dapur", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    value = state.catatan,
                    onValueChange = viewModel::ubahCatatan,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Jangan pedas, saus dipisah") },
                    supportingText = { Text("${state.catatan.length}/$PANJANG_MAKS_CATATAN") },
                    shape = MaterialTheme.shapes.small
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Jumlah", style = MaterialTheme.typography.titleMedium)
                    OutlinedButton(
                        onClick = { viewModel.ubahJumlah(-1) },
                        enabled = state.jumlah > 1
                    ) { Text("-") }
                    Text(state.jumlah.toString(), style = MaterialTheme.typography.titleLarge)
                    OutlinedButton(onClick = { viewModel.ubahJumlah(1) }) { Text("+") }
                }
            }

            Button(
                onClick = { onTambahKeKeranjang(state.jumlah, state.catatan.ifBlank { null }) },
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                enabled = item.isAvailable
            ) {
                Text(
                    if (item.isAvailable) {
                        "Tambah - ${rupiah(item.price * state.jumlah)}"
                    } else {
                        "Sedang habis"
                    }
                )
            }
        }
    }
}
