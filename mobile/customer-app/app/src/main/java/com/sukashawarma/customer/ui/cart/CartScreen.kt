package com.sukashawarma.customer.ui.cart

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint

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
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Keranjang Pesanan",
                subjudul = if (state.porsi > 0) "${state.porsi} item dipilih" else null,
                onKembali = onKembali
            )
        },
        bottomBar = {
            if (state.baris.isNotEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.White,
                    shadowElevation = 12.dp,
                    border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.6f)),
                    shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Total Pembayaran",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaMuted,
                                        fontSize = 11.sp
                                    )
                                )
                                Text(
                                    text = rupiah(state.subtotal),
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        color = SukaBrown,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 19.sp
                                    )
                                )
                            }

                            val bayarInteraction = remember { MutableInteractionSource() }
                            Button(
                                onClick = onLanjutBayar,
                                interactionSource = bayarInteraction,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = SukaOrange,
                                    contentColor = SukaInk
                                ),
                                shape = RoundedCornerShape(18.dp),
                                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
                                modifier = Modifier.bounceClick(scaleDown = 0.94f, interactionSource = bayarInteraction)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "Lanjut Pembayaran",
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 13.sp
                                    )
                                    Icon(
                                        Icons.Filled.ArrowForward,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            if (state.baris.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
                    EmptyState(
                        judul = "Keranjang masih kosong",
                        penjelasan = "Pilih shawarma favoritmu dari katalog untuk mulai memesan."
                    )
                }
                return@Column
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Info Self Pickup Banner
                item(key = "pickup-badge") {
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(SukaOrange.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.LocationOn,
                                    contentDescription = null,
                                    tint = SukaOrange,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Column {
                                Text(
                                    text = "PESANAN PICKUP (AMBIL SENDIRI)",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaBrown,
                                        fontSize = 10.sp,
                                        letterSpacing = 0.5.sp
                                    )
                                )
                                Text(
                                    text = "Siap diambil di outlet tanpa antrean",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = SukaMuted,
                                        fontSize = 11.sp
                                    )
                                )
                            }
                        }
                    }
                }

                // Item Lines
                itemsIndexed(state.baris, key = { index, b -> "${index}_${b.menuItemId}_${b.catatan}_${b.toppings.size}" }) { index, baris ->
                    BarisKeranjangStitch(
                        baris = baris,
                        onKurang = { viewModel.ubahJumlah(index, -1) },
                        onTambah = { viewModel.ubahJumlah(index, 1) },
                        onHapusTopping = { toppingId -> viewModel.hapusTopping(index, toppingId) }
                    )
                }

                // Ringkasan Biaya
                item(key = "ringkasan-biaya") {
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 16.dp),
                        shape = RoundedCornerShape(18.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f))
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "Ringkasan Pembayaran",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaInk,
                                    fontSize = 14.sp
                                )
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Subtotal Item", style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted))
                                Text(rupiah(state.subtotal), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = SukaInk))
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Biaya Pengambilan (Pickup)", style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted))
                                Text("GRATIS", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.ExtraBold, color = SukaGreen))
                            }

                            HorizontalDivider(color = SukaBorder.copy(alpha = 0.5f))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Total Tagihan", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = SukaInk))
                                Text(rupiah(state.subtotal), style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = SukaBrown))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BarisKeranjangStitch(
    baris: CartLine,
    onKurang: () -> Unit,
    onTambah: () -> Unit,
    onHapusTopping: (toppingMenuItemId: String) -> Unit
) {
    val totalHargaBaris = (baris.hargaSatuan + baris.toppings.sumOf { it.hargaSatuan }) * baris.jumlah

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        shadowElevation = 2.dp,
        border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = baris.nama,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 15.sp
                        ),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!baris.catatan.isNullOrBlank()) {
                        Text(
                            text = "\"${baris.catatan}\"",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = SukaMuted,
                                fontSize = 11.sp,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                            ),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Text(
                        text = rupiah(baris.hargaSatuan * baris.jumlah),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaBrown,
                            fontSize = 15.sp
                        )
                    )
                }

                // Stepper Pill (- / + / Hapus)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(SukaTint)
                        .border(BorderStroke(1.dp, SukaBorder), CircleShape)
                        .padding(horizontal = 6.dp, vertical = 3.dp)
                ) {
                    // Minus / Trash
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .bounceClick(scaleDown = 0.88f) { onKurang() },
                        contentAlignment = Alignment.Center
                    ) {
                        if (baris.jumlah <= 1) {
                            Icon(
                                Icons.Filled.DeleteOutline,
                                contentDescription = "Hapus",
                                tint = Color.Red.copy(alpha = 0.8f),
                                modifier = Modifier.size(15.dp)
                            )
                        } else {
                            Icon(
                                Icons.Filled.Remove,
                                contentDescription = "Kurang",
                                tint = SukaInk,
                                modifier = Modifier.size(15.dp)
                            )
                        }
                    }

                    Text(
                        text = baris.jumlah.toString(),
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaInk,
                            fontSize = 13.sp
                        ),
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )

                    // Plus
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(CircleShape)
                            .background(SukaOrange)
                            .bounceClick(scaleDown = 0.88f) { onTambah() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.Add,
                            contentDescription = "Tambah",
                            tint = SukaInk,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                }
            }

            // Sub-item Toppings jika ada
            if (baris.toppings.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SukaTint.copy(alpha = 0.55f))
                        .border(BorderStroke(1.dp, SukaBorder.copy(alpha = 0.5f)), RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    baris.toppings.forEach { topping ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = "+ ${topping.nama}",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        fontWeight = FontWeight.SemiBold,
                                        color = SukaInk,
                                        fontSize = 12.sp
                                    )
                                )
                                Text(
                                    text = "(+${rupiah(topping.hargaSatuan * baris.jumlah)})",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaBrown,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                )
                            }

                            // Tombol Batal Topping [x]
                            Box(
                                modifier = Modifier
                                    .size(22.dp)
                                    .clip(CircleShape)
                                    .background(Color.White)
                                    .border(BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f)), CircleShape)
                                    .bounceClick(scaleDown = 0.85f) { onHapusTopping(topping.menuItemId) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Hapus topping ${topping.nama}",
                                    tint = SukaMuted,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }
                    }
                }

                // Baris Subtotal gabungan Item + Topping
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Total Item & Topping",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Text(
                        text = rupiah(totalHargaBaris),
                        style = MaterialTheme.typography.bodyMedium.copy(
                            color = SukaBrown,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 13.sp
                        )
                    )
                }
            }
        }
    }
}
