package com.sukashawarma.customer.ui.product

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.sukashawarma.customer.data.CartLine
import com.sukashawarma.customer.data.PANJANG_MAKS_CATATAN
import com.sukashawarma.customer.data.api.MenuItemDto
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange
import com.sukashawarma.customer.ui.theme.SukaTint
import kotlin.math.roundToLong

@Composable
fun ItemDetailScreen(
    item: MenuItemDto,
    viewModel: ItemDetailViewModel,
    availableToppings: List<MenuItemDto> = emptyList(),
    cartLines: List<CartLine> = emptyList(),
    cartSubtotal: Long = 0,
    cartTotalPorsi: Int = 0,
    onLihatKeranjang: () -> Unit = {},
    onKembali: () -> Unit,
    onTambahKeKeranjang: (jumlah: Int, catatan: String?, selectedToppings: List<MenuItemDto>) -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val scrollState = rememberScrollState()

    val selectedToppingsList = remember(state.selectedToppingIds, availableToppings) {
        availableToppings.filter { state.selectedToppingIds.contains(it.id) }
    }
    val toppingSubtotalPerItem = selectedToppingsList.sumOf { it.price }
    val totalHarga = (item.price + toppingSubtotalPerItem) * state.jumlah

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Detail Menu",
                subjudul = item.name,
                onKembali = onKembali,
                aksiKanan = {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.15f))
                            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.25f)), CircleShape)
                            .bounceClick(scaleDown = 0.90f) { /* no-op share */ },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.Share,
                            contentDescription = "Bagikan",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            )
        },
        bottomBar = {
            // Sticky Floating Bottom CTA Bar tanpa celah background di bawah
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 14.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.6f)),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Jika sudah ada item di keranjang: baris info slim & elegan (menghemat tinggi 50%)
                    if (cartTotalPorsi > 0) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onLihatKeranjang)
                                .padding(vertical = 4.dp, horizontal = 2.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Filled.ShoppingBag,
                                    contentDescription = null,
                                    tint = SukaOrange,
                                    modifier = Modifier.size(15.dp)
                                )
                                Text(
                                    text = "$cartTotalPorsi item di keranjang • ${rupiah(cartSubtotal)}",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaBrown,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 11.sp
                                    )
                                )
                            }
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Lihat",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaOrange,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 11.sp
                                    )
                                )
                                Icon(
                                    Icons.AutoMirrored.Filled.ArrowForward,
                                    contentDescription = "Lihat Keranjang",
                                    tint = SukaOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }
                        HorizontalDivider(color = SukaBorder.copy(alpha = 0.5f), thickness = 0.8.dp)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Total Price Column
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(
                                text = if (cartTotalPorsi > 0) "Total Belanja (+Item ini)" else "Total Harga",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            )
                            Text(
                                text = rupiah(if (cartTotalPorsi > 0) cartSubtotal + totalHarga.roundToLong() else totalHarga.roundToLong()),
                                style = MaterialTheme.typography.titleLarge.copy(
                                    color = SukaBrown,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 19.sp
                                )
                            )
                            if (cartTotalPorsi > 0) {
                                Text(
                                    text = "Item ini: +${rupiah(totalHarga.roundToLong())}",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaMuted,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                )
                            }
                        }

                        // Tambah ke Keranjang CTA Button
                        val ctaInteraction = remember { MutableInteractionSource() }
                        Button(
                            onClick = {
                                if (item.isAvailable) {
                                    onTambahKeKeranjang(state.jumlah, state.catatan.ifBlank { null }, selectedToppingsList)
                                }
                            },
                            enabled = item.isAvailable,
                            interactionSource = ctaInteraction,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk,
                                disabledContainerColor = Color.LightGray,
                                disabledContentColor = Color.DarkGray
                            ),
                            shape = RoundedCornerShape(20.dp),
                            contentPadding = PaddingValues(horizontal = 24.dp, vertical = 14.dp),
                            modifier = Modifier.bounceClick(scaleDown = 0.94f, interactionSource = ctaInteraction)
                        ) {
                            Text(
                                text = if (item.isAvailable) "+ Keranjang" else "Habis",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp
                            )
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
                .verticalScroll(scrollState)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Hero Food Image Container
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(SukaTint)
                    .border(BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f)), RoundedCornerShape(24.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (!item.imageUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        Icons.Filled.Restaurant,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(56.dp)
                    )
                }

                // Badge Favorit
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(14.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(SukaBrown)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "🔥 Terlaris",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 10.sp
                        )
                    )
                }
            }

            // 2. Title, Description, and Base Price
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f))
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = item.name,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = SukaInk,
                            fontSize = 20.sp
                        )
                    )

                    if (!item.description.isNullOrBlank()) {
                        Text(
                            text = item.description,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = SukaMuted,
                                fontSize = 13.sp,
                                lineHeight = 18.sp
                            )
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = rupiah(item.price),
                            style = MaterialTheme.typography.headlineSmall.copy(
                                color = SukaBrown,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 20.sp
                            )
                        )

                        // Quantity Stepper Pill
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(SukaTint)
                                .border(BorderStroke(1.dp, SukaBorder), CircleShape)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            // Minus Button
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(if (state.jumlah > 1) Color.White else Color.Transparent)
                                    .bounceClick(scaleDown = 0.88f) {
                                        if (state.jumlah > 1) viewModel.ubahJumlah(-1)
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.Remove,
                                    contentDescription = "Kurang",
                                    tint = if (state.jumlah > 1) SukaInk else SukaMuted.copy(alpha = 0.4f),
                                    modifier = Modifier.size(16.dp)
                                )
                            }

                            Text(
                                text = state.jumlah.toString(),
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 15.sp
                                ),
                                modifier = Modifier.padding(horizontal = 6.dp)
                            )

                            // Plus Button
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clip(CircleShape)
                                    .background(SukaOrange)
                                    .bounceClick(scaleDown = 0.88f) { viewModel.ubahJumlah(1) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Filled.Add,
                                    contentDescription = "Tambah",
                                    tint = SukaInk,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. Opsi Tambahan Topping (keju / kentang)
            if (availableToppings.isNotEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = Color.White,
                    shadowElevation = 2.dp,
                    border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f))
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Tambahan Topping",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaInk,
                                        fontSize = 15.sp
                                    )
                                )
                                Text(
                                    text = "Pilih topping ekstra favoritmu",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = SukaMuted,
                                        fontSize = 11.sp
                                    )
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SukaTint)
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = "Opsional",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = SukaBrown,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            availableToppings.forEach { topping ->
                                val isChecked = state.selectedToppingIds.contains(topping.id)
                                Surface(
                                    onClick = { viewModel.toggleTopping(topping.id) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .bounceClick(scaleDown = 0.98f),
                                    shape = RoundedCornerShape(14.dp),
                                    color = if (isChecked) SukaTint else Color.White,
                                    border = BorderStroke(
                                        1.5.dp,
                                        if (isChecked) SukaOrange else SukaBorder.copy(alpha = 0.8f)
                                    )
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 14.dp, vertical = 12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(22.dp)
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(if (isChecked) SukaOrange else Color.Transparent)
                                                    .border(
                                                        BorderStroke(
                                                            1.5.dp,
                                                            if (isChecked) SukaOrange else SukaMuted.copy(alpha = 0.5f)
                                                        ),
                                                        RoundedCornerShape(6.dp)
                                                    ),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                if (isChecked) {
                                                    Icon(
                                                        imageVector = Icons.Filled.Check,
                                                        contentDescription = null,
                                                        tint = Color.White,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                }
                                            }

                                            Column {
                                                Text(
                                                    text = topping.name,
                                                    style = MaterialTheme.typography.titleSmall.copy(
                                                        fontWeight = FontWeight.Bold,
                                                        color = SukaInk,
                                                        fontSize = 13.sp
                                                    )
                                                )
                                                if (!topping.description.isNullOrBlank()) {
                                                    Text(
                                                        text = topping.description,
                                                        style = MaterialTheme.typography.bodySmall.copy(
                                                            color = SukaMuted,
                                                            fontSize = 11.sp
                                                        )
                                                    )
                                                }
                                            }
                                        }

                                        Text(
                                            text = "+${rupiah(topping.price)}",
                                            style = MaterialTheme.typography.titleSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = if (isChecked) SukaOrange else SukaBrown,
                                                fontSize = 13.sp
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. Catatan Tambahan Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.7f))
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Catatan Tambahan",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 15.sp
                        )
                    )

                    OutlinedTextField(
                        value = state.catatan,
                        onValueChange = viewModel::ubahCatatan,
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = {
                            Text(
                                "Contoh: Jangan terlalu pedas, saus garlic dipisah...",
                                fontSize = 12.sp,
                                color = SukaMuted
                            )
                        },
                        supportingText = {
                            Text(
                                "${state.catatan.length}/$PANJANG_MAKS_CATATAN karakter",
                                fontSize = 11.sp,
                                color = SukaMuted
                            )
                        },
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = SukaTint,
                            unfocusedContainerColor = SukaTint,
                            focusedBorderColor = SukaOrange,
                            unfocusedBorderColor = SukaBorder,
                            cursorColor = SukaOrange
                        ),
                        maxLines = 3
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
