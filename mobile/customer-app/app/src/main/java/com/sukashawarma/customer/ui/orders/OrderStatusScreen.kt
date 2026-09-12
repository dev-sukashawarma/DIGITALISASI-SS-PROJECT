package com.sukashawarma.customer.ui.orders

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sukashawarma.customer.ui.components.ErrorState
import com.sukashawarma.customer.ui.components.MemuatState
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

@Composable
fun OrderStatusScreen(
    viewModel: OrderStatusViewModel,
    onKembali: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val scrollState = rememberScrollState()

    // Animasi denyut live badge
    val infiniteTransition = rememberInfiniteTransition(label = "pulseLive")
    val liveAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000),
            repeatMode = RepeatMode.Reverse
        ),
        label = "liveAlpha"
    )

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = SukaCream,
                shadowElevation = 1.dp
            ) {
                Row(
                    modifier = Modifier
                        .statusBarsPadding()
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .bounceClick(onClick = onKembali),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Kembali",
                            tint = SukaBrown,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Status Pesanan",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 16.sp
                            )
                        )
                        Text(
                            text = "Ambil Mandiri di Outlet",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = SukaMuted,
                                fontSize = 11.sp
                            )
                        )
                    }

                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .bounceClick(onClick = viewModel::muat),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Refresh,
                            contentDescription = "Segarkan",
                            tint = SukaOrange,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }
    ) { padding ->
        val pesanan = state.pesanan

        when {
            state.memuat && pesanan == null -> {
                Box(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    MemuatState()
                }
            }

            pesanan == null && state.galat != null -> {
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

            pesanan != null -> {
                val tampil = tampilanStatus(pesanan.statusDapur)

                Column(
                    modifier = Modifier
                        .padding(padding)
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(horizontal = 18.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // 1. Live Kitchen Status Hero Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(24.dp),
                        color = Color.Transparent,
                        shadowElevation = 8.dp
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    Brush.linearGradient(
                                        listOf(
                                            SukaBrown,
                                            Color(0xFF5D1203),
                                            Color(0xFF450C02)
                                        )
                                    )
                                )
                                .padding(20.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                // Live Badge
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(20.dp),
                                        color = SukaOrange.copy(alpha = 0.25f),
                                        border = BorderStroke(1.dp, SukaOrange.copy(alpha = 0.5f))
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(7.dp)
                                                    .alpha(liveAlpha)
                                                    .clip(CircleShape)
                                                    .background(SukaOrange)
                                            )
                                            Text(
                                                text = "LIVE DARI DAPUR 🔥",
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    fontWeight = FontWeight.Black,
                                                    color = SukaOrange,
                                                    fontSize = 10.sp,
                                                    letterSpacing = 0.5.sp
                                                )
                                            )
                                        }
                                    }

                                    Text(
                                        text = if (tampil.selesai) "Selesai" else "Tepat Waktu",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = Color.White.copy(alpha = 0.75f),
                                            fontSize = 11.sp
                                        )
                                    )
                                }

                                // Status Title & Subtitle
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        text = when (tampil.tahap) {
                                            TahapPesanan.DITERIMA -> "Pesanan Diterima!"
                                            TahapPesanan.DIBUAT -> "Shawarma Kamu Sedang Dibuat!"
                                            TahapPesanan.SIAP -> if (tampil.selesai) "Pesanan Sudah Diambil" else "Pesanan Siap Diambil! 🎉"
                                            null -> tampil.judul
                                        },
                                        style = MaterialTheme.typography.headlineSmall.copy(
                                            fontFamily = LilitaOne,
                                            color = Color.White,
                                            fontSize = 20.sp,
                                            lineHeight = 26.sp
                                        )
                                    )
                                    Text(
                                        text = tampil.penjelasan,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = Color.White.copy(alpha = 0.85f),
                                            fontSize = 12.sp,
                                            lineHeight = 16.sp
                                        )
                                    )
                                }

                                // Progress ETA Pill
                                if (!tampil.dibatalkan) {
                                    Surface(
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(14.dp),
                                        color = Color.White.copy(alpha = 0.12f),
                                        border = BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
                                    ) {
                                        Column(
                                            modifier = Modifier.padding(12.dp),
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Filled.Schedule,
                                                        contentDescription = null,
                                                        tint = SukaOrange,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                    Text(
                                                        text = when (tampil.tahap) {
                                                            TahapPesanan.DITERIMA -> "Estimasi Siap: ~15-20 mnt"
                                                            TahapPesanan.DIBUAT -> "Estimasi Siap: ~5-10 mnt"
                                                            TahapPesanan.SIAP -> if (tampil.selesai) "Selesai" else "Siap Diambil Sekarang!"
                                                            null -> "Menunggu"
                                                        },
                                                        style = MaterialTheme.typography.labelSmall.copy(
                                                            fontWeight = FontWeight.Bold,
                                                            color = Color.White,
                                                            fontSize = 11.sp
                                                        )
                                                    )
                                                }

                                                Text(
                                                    text = "Self-Pickup",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontWeight = FontWeight.Medium,
                                                        color = SukaOrange,
                                                        fontSize = 10.sp
                                                    )
                                                )
                                            }

                                            // Progress bar
                                            val progress = when (tampil.tahap) {
                                                TahapPesanan.DITERIMA -> 0.33f
                                                TahapPesanan.DIBUAT -> 0.66f
                                                TahapPesanan.SIAP -> 1f
                                                null -> 0.1f
                                            }

                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .height(6.dp)
                                                    .clip(RoundedCornerShape(3.dp))
                                                    .background(Color.Black.copy(alpha = 0.3f))
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .fillMaxWidth(progress)
                                                        .height(6.dp)
                                                        .clip(RoundedCornerShape(3.dp))
                                                        .background(
                                                            Brush.horizontalGradient(
                                                                listOf(SukaOrange, Color(0xFFFBBF24))
                                                            )
                                                        )
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 2. Ticket Pass Card (Order Number)
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(22.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder),
                        shadowElevation = 3.dp
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "NOMOR PESANAN KASIR",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = SukaMuted,
                                    fontSize = 10.sp,
                                    letterSpacing = 1.sp
                                )
                            )

                            Text(
                                text = pesanan.posOrderNumber?.let { "#$it" } ?: "#-",
                                style = MaterialTheme.typography.headlineLarge.copy(
                                    fontFamily = LilitaOne,
                                    color = SukaBrown,
                                    fontSize = 42.sp,
                                    letterSpacing = 2.sp
                                )
                            )

                            pesanan.outletName?.let { outlet ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Storefront,
                                        contentDescription = null,
                                        tint = SukaOrange,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        text = outlet,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaInk,
                                            fontSize = 12.sp
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // 3. Vertical Kitchen Stepper Timeline
                    if (!tampil.dibatalkan) {
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(22.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, SukaBorder),
                            shadowElevation = 2.dp
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(20.dp),
                                verticalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                Text(
                                    text = "Tahapan Pesanan",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SukaBrown,
                                        fontSize = 14.sp
                                    )
                                )

                                val diterimaSelesai = tahapTercapai(tampil.tahap, TahapPesanan.DITERIMA)
                                val dibuatSelesai = tahapTercapai(tampil.tahap, TahapPesanan.DIBUAT)
                                val siapSelesai = tahapTercapai(tampil.tahap, TahapPesanan.SIAP)

                                TimelineStep(
                                    title = "Pesanan Diterima",
                                    desc = "Kasir telah menerima & memvalidasi pesananmu",
                                    isDone = diterimaSelesai,
                                    isActive = tampil.tahap == TahapPesanan.DITERIMA,
                                    isLast = false
                                )

                                TimelineStep(
                                    title = "Sedang Dimasak",
                                    desc = "Dapur sedang memanggang ayam & menggulung segar",
                                    isDone = dibuatSelesai,
                                    isActive = tampil.tahap == TahapPesanan.DIBUAT,
                                    isLast = false
                                )

                                TimelineStep(
                                    title = "Siap Diambil",
                                    desc = "Langsung menuju counter Online Pickup tanpa antre",
                                    isDone = siapSelesai,
                                    isActive = tampil.tahap == TahapPesanan.SIAP,
                                    isLast = true
                                )
                            }
                        }
                    }

                    // 4. Order Total Breakdown Card
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(18.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, SukaBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 18.dp, vertical = 14.dp),
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
                                    text = "QRIS Lunas",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = SukaGreen,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                            Text(
                                text = rupiah(pesanan.totalAmount),
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontFamily = LilitaOne,
                                    color = SukaBrown,
                                    fontSize = 20.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TimelineStep(
    title: String,
    desc: String,
    isDone: Boolean,
    isActive: Boolean,
    isLast: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isDone && !isActive -> SukaGreen
                            isActive -> SukaOrange
                            else -> Color(0xFFF3F4F6)
                        }
                    )
                    .border(
                        BorderStroke(
                            2.dp,
                            when {
                                isDone || isActive -> Color.White
                                else -> Color(0xFFD1D5DB)
                            }
                        ),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                if (isDone && !isActive) {
                    Icon(
                        imageVector = Icons.Filled.Check,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                } else if (isActive) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                    )
                }
            }

            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(36.dp)
                        .background(if (isDone) SukaGreen else Color(0xFFE5E7EB))
                )
            }
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(
                    fontWeight = if (isActive || isDone) FontWeight.Bold else FontWeight.Medium,
                    color = if (isActive || isDone) SukaInk else SukaMuted,
                    fontSize = 13.sp
                )
            )
            Text(
                text = desc,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = SukaMuted,
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
            )
        }
    }
}
