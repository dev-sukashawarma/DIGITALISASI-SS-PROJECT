package com.sukashawarma.customer.ui.orders

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.data.api.OrderDetailDto
import com.sukashawarma.customer.ui.components.BottomNavTab
import com.sukashawarma.customer.ui.components.EmptyState
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
import com.sukashawarma.customer.ui.components.PageBrandHeader
import com.sukashawarma.customer.ui.components.SukaBottomNavBar
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.format.rupiah
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange

enum class FilterRiwayat { SEMUA, BERJALAN, SELESAI, BATAL }

@Composable
fun HistoryScreen(
    viewModel: HistoryViewModel,
    onBukaPesanan: (String) -> Unit,
    onKembali: () -> Unit,
    onBukaProfil: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var selectedFilter by remember { mutableStateOf(FilterRiwayat.SEMUA) }

    val infiniteTransition = rememberInfiniteTransition(label = "pulseActive")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            Column(modifier = Modifier.fillMaxWidth()) {
                PageBrandHeader(
                    judul = "Riwayat Pesanan",
                    subjudul = "Pantau status & riwayat pesananmu",
                    onKembali = null,
                    aksiKanan = {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(SukaOrange)
                                .bounceClick(scaleDown = 0.94f) { onBukaProfil() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "SK",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaInk,
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                )

                // Filter Tab Row
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                        item {
                            FilterChip(
                                label = "Semua",
                                isSelected = selectedFilter == FilterRiwayat.SEMUA,
                                onClick = { selectedFilter = FilterRiwayat.SEMUA }
                            )
                        }
                        item {
                            FilterChip(
                                label = "Sedang Berjalan",
                                isSelected = selectedFilter == FilterRiwayat.BERJALAN,
                                onClick = { selectedFilter = FilterRiwayat.BERJALAN }
                            )
                        }
                        item {
                            FilterChip(
                                label = "Selesai",
                                isSelected = selectedFilter == FilterRiwayat.SELESAI,
                                onClick = { selectedFilter = FilterRiwayat.SELESAI }
                            )
                        }
                        item {
                            FilterChip(
                                label = "Dibatalkan",
                                isSelected = selectedFilter == FilterRiwayat.BATAL,
                                onClick = { selectedFilter = FilterRiwayat.BATAL }
                            )
                    }
                }
            }
        }
    ) { padding ->
        when {
            state.memuat -> {
                Box(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    MemuatState()
                }
            }

            state.galat != null -> {
                Box(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    ErrorState(
                        error = state.galat!!,
                        onCobaLagi = viewModel::muat
                    )
                }
            }

            state.pesanan.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    EmptyState(
                        judul = "Belum Ada Pesanan",
                        penjelasan = "Pesanan yang sudah kamu bayar akan muncul di sini."
                    )
                }
            }

            else -> {
                val filteredList = remember(state.pesanan, selectedFilter) {
                    when (selectedFilter) {
                        FilterRiwayat.SEMUA -> state.pesanan
                        FilterRiwayat.BERJALAN -> state.pesanan.filter {
                            val t = tampilanStatus(it.statusDapur)
                            t.tahap != null && !t.selesai && !t.dibatalkan
                        }
                        FilterRiwayat.SELESAI -> state.pesanan.filter {
                            tampilanStatus(it.statusDapur).selesai
                        }
                        FilterRiwayat.BATAL -> state.pesanan.filter {
                            tampilanStatus(it.statusDapur).dibatalkan
                        }
                    }
                }

                if (filteredList.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .padding(padding)
                            .fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        EmptyState(
                            judul = "Tidak Ada Pesanan",
                            penjelasan = "Tidak ada pesanan untuk kategori filter ini."
                        )
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .padding(padding)
                            .fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredList, key = { it.id }) { pesanan ->
                            val statusTampil = tampilanStatus(pesanan.statusDapur)
                            val isActive = statusTampil.tahap != null && !statusTampil.selesai && !statusTampil.dibatalkan

                            if (isActive) {
                                ActiveOrderCard(
                                    pesanan = pesanan,
                                    statusTampil = statusTampil,
                                    pulseAlpha = pulseAlpha,
                                    onKlik = { onBukaPesanan(pesanan.id) }
                                )
                            } else {
                                StandardOrderCard(
                                    pesanan = pesanan,
                                    statusTampil = statusTampil,
                                    onKlik = { onBukaPesanan(pesanan.id) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = if (isSelected) SukaOrange else Color.White,
        border = if (isSelected) null else BorderStroke(1.dp, SukaBorder),
        shadowElevation = if (isSelected) 3.dp else 1.dp,
        modifier = Modifier.bounceClick(scaleDown = 0.94f) { onClick() }
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                color = if (isSelected) SukaBrown else SukaInk,
                fontSize = 11.sp
            )
        )
    }
}

@Composable
private fun ActiveOrderCard(
    pesanan: OrderDetailDto,
    statusTampil: TampilanStatus,
    pulseAlpha: Float,
    onKlik: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .bounceClick(onClick = onKlik),
        shape = RoundedCornerShape(22.dp),
        color = Color.White,
        border = BorderStroke(2.dp, SukaOrange),
        shadowElevation = 6.dp
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFFF4EB),
                    border = BorderStroke(1.dp, Color(0xFFFBD9BC))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .alpha(pulseAlpha)
                                .clip(CircleShape)
                                .background(SukaOrange)
                        )
                        Text(
                            text = statusTampil.judul,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 10.sp
                            )
                        )
                    }
                }

                Text(
                    text = pesanan.posOrderNumber?.let { "#$it" } ?: "#SS",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontFamily = LilitaOne,
                        color = SukaBrown,
                        fontSize = 16.sp
                    )
                )
            }

            pesanan.outletName?.let { outlet ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Storefront,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(15.dp)
                    )
                    Text(
                        text = outlet,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 13.sp
                        )
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFF5EADB))
            )

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
                            fontSize = 10.sp
                        )
                    )
                    Text(
                        text = rupiah(pesanan.totalAmount),
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontFamily = LilitaOne,
                            color = SukaBrown,
                            fontSize = 16.sp
                        )
                    )
                }

                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = SukaOrange,
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "Lihat Status",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 11.sp
                            )
                        )
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = null,
                            tint = SukaBrown,
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StandardOrderCard(
    pesanan: OrderDetailDto,
    statusTampil: TampilanStatus,
    onKlik: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .bounceClick(onClick = onKlik),
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, SukaBorder),
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(SukaCream),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.ReceiptLong,
                    contentDescription = null,
                    tint = SukaBrown,
                    modifier = Modifier.size(22.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = pesanan.posOrderNumber?.let { "Pesanan #$it" } ?: "Pesanan",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = SukaInk,
                            fontSize = 14.sp
                        )
                    )

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = when {
                            statusTampil.selesai -> Color(0xFFECFDF5)
                            statusTampil.dibatalkan -> Color(0xFFFEF2F2)
                            else -> Color(0xFFFFF4EB)
                        }
                    ) {
                        Text(
                            text = statusTampil.judul,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = when {
                                    statusTampil.selesai -> SukaGreen
                                    statusTampil.dibatalkan -> Color(0xFFDC2626)
                                    else -> SukaOrange
                                },
                                fontSize = 9.sp
                            )
                        )
                    }
                }

                pesanan.outletName?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = SukaMuted,
                            fontSize = 11.sp
                        ),
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                Text(
                    text = rupiah(pesanan.totalAmount),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = SukaBrown,
                        fontSize = 13.sp
                    ),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = SukaMuted,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
