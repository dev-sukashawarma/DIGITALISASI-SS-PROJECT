package com.sukashawarma.customer.ui.checkout

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.sukashawarma.customer.data.api.CartProblemDto
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
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
fun CheckoutScreen(
    viewModel: CheckoutViewModel,
    onKembali: () -> Unit,
    onBayar: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            PageBrandHeader(
                judul = "Ringkasan Pesanan",
                subjudul = "Detail tagihan & pembayaran",
                onKembali = onKembali
            )
        },
        bottomBar = {
            if (!state.keranjangKosong && !state.memuat && state.galat == null) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color.White,
                    shadowElevation = 12.dp,
                    border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.6f)),
                    shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Total Tagihan",
                                style = MaterialTheme.typography.labelSmall.copy(color = SukaMuted, fontSize = 11.sp)
                            )
                            Text(
                                text = state.total?.let { rupiah(it) } ?: "-",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    color = SukaBrown,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 19.sp
                                )
                            )
                        }

                        val bayarInteraction = remember { MutableInteractionSource() }
                        Button(
                            onClick = onBayar,
                            enabled = state.bolehLanjut,
                            interactionSource = bayarInteraction,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SukaOrange,
                                contentColor = SukaInk,
                                disabledContainerColor = Color.LightGray,
                                disabledContentColor = Color.DarkGray
                            ),
                            shape = RoundedCornerShape(18.dp),
                            contentPadding = PaddingValues(horizontal = 22.dp, vertical = 14.dp),
                            modifier = Modifier.bounceClick(scaleDown = 0.94f, interactionSource = bayarInteraction)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(Icons.Filled.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                                Text(
                                    text = if (state.bolehLanjut) "Bayar Sekarang" else "Periksa Pesanan",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {

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

                else -> IsiStitch(state = state, viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun IsiStitch(
    state: CheckoutState,
    viewModel: CheckoutViewModel
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Pickup Notice Card
        item(key = "pickup-notice") {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(SukaOrange.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Filled.LocationOn,
                            contentDescription = null,
                            tint = SukaOrange,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Column {
                        Text(
                            text = "PENGAMBILAN DI OUTLET",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 10.sp
                            )
                        )
                        Text(
                            text = "Pesanan disiapkan saat pembayaran terkonfirmasi",
                            style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted, fontSize = 12.sp)
                        )
                    }
                }
            }
        }

        // 2. Pesan Penolakan jika ada
        state.pesanPenolakan?.let { pesan ->
            item(key = "penolakan") {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = Color(0xFFFEE2E2),
                    border = BorderStroke(1.dp, Color(0xFFFCA5A5))
                ) {
                    Row(modifier = Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Filled.Warning, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(18.dp))
                        Text(pesan, style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF991B1B)))
                    }
                }
            }
        }

        // 3. Masalah Cart
        items(state.masalah, key = { it.menuItemId + it.jenis }) { masalah ->
            KartuMasalah(masalah = masalah, onPerbaiki = { viewModel.perbaiki(masalah) })
        }

        if (state.masalah.size > 1) {
            item(key = "perbaiki-semua") {
                OutlinedButton(
                    onClick = viewModel::perbaikiSemua,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("Perbaiki semuanya", color = SukaBrown, fontWeight = FontWeight.Bold)
                }
            }
        }

        // 4. Daftar Item Pesanan Card
        item(key = "card-items") {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Rincian Menu",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        )
                    )

                    state.baris.forEach { baris ->
                        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${baris.jumlah}x ${baris.nama}",
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontWeight = FontWeight.SemiBold,
                                            color = SukaInk
                                        )
                                    )
                                    if (!baris.catatan.isNullOrBlank()) {
                                        Text(
                                            text = "\"${baris.catatan}\"",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = SukaMuted,
                                                fontSize = 11.sp
                                            )
                                        )
                                    }
                                }
                                Text(
                                    text = rupiah(baris.hargaSatuan * baris.jumlah),
                                    style = MaterialTheme.typography.bodyMedium.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SukaBrown
                                    )
                                )
                            }

                            // Sub-item Toppings
                            baris.toppings.forEach { topping ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(start = 16.dp, top = 3.dp, bottom = 1.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = "↳",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = SukaOrange,
                                                fontWeight = FontWeight.Bold
                                            )
                                        )
                                        Text(
                                            text = "+ ${topping.nama}",
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = SukaMuted,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        )
                                    }
                                    Text(
                                        text = rupiah(topping.hargaSatuan * baris.jumlah),
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = FontWeight.SemiBold,
                                            color = SukaBrown.copy(alpha = 0.85f),
                                            fontSize = 12.sp
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // 5. Metode Pembayaran Card ala Stitch
        item(key = "payment-methods") {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Metode Pembayaran",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        )
                    )

                    // QRIS Option (Terpilih)
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        color = SukaTint,
                        border = BorderStroke(1.5.dp, SukaOrange)
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(34.dp)
                                        .clip(CircleShape)
                                        .background(SukaOrange),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Filled.QrCode2,
                                        contentDescription = "QRIS",
                                        tint = SukaInk,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = "QRIS (Semua E-Wallet & Bank)",
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaInk,
                                            fontSize = 13.sp
                                        )
                                    )
                                    Text(
                                        text = "Verifikasi instan otomatis",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = SukaMuted,
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                            }
                            Icon(
                                Icons.Filled.CheckCircle,
                                contentDescription = "Terpilih",
                                tint = SukaOrange,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        }

        // 6. Rincian Biaya
        item(key = "ringkasan-total") {
            Surface(
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                shape = RoundedCornerShape(18.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.8f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Ringkasan Pembayaran",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        )
                    )

                    state.subtotal?.let {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Subtotal", style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted))
                            Text(rupiah(it), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = SukaInk))
                        }
                    }

                    state.potongan?.takeIf { it > 0 }?.let {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Potongan Promo", style = MaterialTheme.typography.bodySmall.copy(color = SukaGreen))
                            Text("- ${rupiah(it)}", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = SukaGreen))
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Biaya Layanan & Pengambilan", style = MaterialTheme.typography.bodySmall.copy(color = SukaMuted))
                        Text("GRATIS", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.ExtraBold, color = SukaGreen))
                    }

                    HorizontalDivider(color = SukaBorder.copy(alpha = 0.5f))

                    state.total?.let {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Total yang Dibayar", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = SukaInk))
                            Text(rupiah(it), style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = SukaBrown))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KartuMasalah(masalah: CartProblemDto, onPerbaiki: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFFEF3C7),
        border = BorderStroke(1.dp, Color(0xFFFCD34D))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                pesanUntukMasalah(masalah),
                style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF92400E)),
                modifier = Modifier.weight(1f)
            )
            OutlinedButton(
                onClick = onPerbaiki,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = SukaBrown)
            ) {
                Text(labelTindakan(masalah), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
