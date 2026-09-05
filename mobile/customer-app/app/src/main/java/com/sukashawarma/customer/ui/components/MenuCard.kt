package com.sukashawarma.customer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaTint

/**
 * Satu baris menu di katalog.
 *
 * Item habis TIDAK disembunyikan: ia tampil diredupkan, diberi label "Habis",
 * dan tidak bisa diketuk. Menyembunyikannya membuat pelanggan mengira menu
 * favoritnya sudah dihapus selamanya dan bertanya ke kasir.
 */
@Composable
fun MenuCard(
    item: MenuItemDto,
    onKlik: (MenuItemDto) -> Unit,
    modifier: Modifier = Modifier
) {
    val tersedia = item.isAvailable

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .then(if (tersedia) Modifier.clickable { onKlik(item) } else Modifier),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Row(
            modifier = Modifier.padding(12.dp).alpha(if (tersedia) 1f else 0.45f),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(SukaTint),
                contentAlignment = Alignment.Center
            ) {
                if (item.imageUrl != null) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(72.dp)
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    item.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (!item.description.isNullOrBlank()) {
                    Text(
                        item.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    rupiah(item.price),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            if (!tersedia) {
                Text(
                    "Habis",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Kepala layar katalog: nama outlet, status buka, dan jalan keluar untuk
 * berpindah outlet.
 *
 * Sengaja TIDAK menampilkan jarak maupun perkiraan waktu siap yang ada di
 * artboard: gateway tidak mengirim keduanya, dan angka karangan di layar
 * pelanggan adalah janji yang tidak bisa ditepati siapa pun.
 */
@Composable
fun OutletHeader(
    namaOutlet: String,
    buka: Boolean,
    onGantiOutlet: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                namaOutlet,
                style = MaterialTheme.typography.headlineSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                if (buka) "Buka" else "Belum buka",
                style = MaterialTheme.typography.bodySmall,
                color = if (buka) {
                    com.sukashawarma.customer.ui.theme.SukaGreen
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
        Text(
            "Ganti",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .clip(MaterialTheme.shapes.small)
                .clickable { onGantiOutlet() }
                .padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}
