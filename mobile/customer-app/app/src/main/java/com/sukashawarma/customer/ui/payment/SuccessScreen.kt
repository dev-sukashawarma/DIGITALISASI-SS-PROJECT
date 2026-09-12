package com.sukashawarma.customer.ui.payment

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sukashawarma.customer.ui.components.bounceClick
import com.sukashawarma.customer.ui.theme.LilitaOne
import com.sukashawarma.customer.ui.theme.SukaBorder
import com.sukashawarma.customer.ui.theme.SukaBrown
import com.sukashawarma.customer.ui.theme.SukaCream
import com.sukashawarma.customer.ui.theme.SukaGreen
import com.sukashawarma.customer.ui.theme.SukaInk
import com.sukashawarma.customer.ui.theme.SukaMuted
import com.sukashawarma.customer.ui.theme.SukaOrange

/**
 * Layar 12 - Pesanan Berhasil & Tiket Digital Pickup Pass ala Stitch Design.
 */
@Composable
fun SuccessScreen(
    nomorPesanan: Int?,
    namaOutlet: String?,
    onLihatStatus: () -> Unit,
    onKembaliKeKatalog: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    // Animasi denyut badge
    val infiniteTransition = rememberInfiniteTransition(label = "pulseGlow")
    val glowScale by infiniteTransition.animateFloat(
        initialValue = 0.9f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glowScale"
    )

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = SukaCream,
        topBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = SukaCream
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
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color.White)
                            .bounceClick(onClick = onKembaliKeKatalog),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Tutup",
                            tint = SukaBrown,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color(0xFFFFF3E8),
                        border = BorderStroke(1.dp, SukaOrange.copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = "ORDER-AHEAD & PICK-UP",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = SukaBrown,
                                fontSize = 10.sp,
                                letterSpacing = 0.5.sp
                            )
                        )
                    }

                    Box(modifier = Modifier.size(38.dp))
                }
            }
        },
        bottomBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color.White,
                shadowElevation = 12.dp,
                border = BorderStroke(1.dp, SukaBorder.copy(alpha = 0.6f)),
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
            ) {
                Column(
                    modifier = Modifier
                        .navigationBarsPadding()
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Button(
                        onClick = onLihatStatus,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .bounceClick(),
                        shape = RoundedCornerShape(26.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SukaOrange,
                            contentColor = SukaBrown
                        ),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 3.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Lihat Status Pesanan",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaBrown,
                                    fontSize = 15.sp
                                )
                            )
                            Icon(
                                imageVector = Icons.Filled.ArrowForward,
                                contentDescription = null,
                                tint = SukaBrown,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    TextButton(
                        onClick = onKembaliKeKatalog,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Kembali ke Menu",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = SukaMuted,
                                fontSize = 13.sp
                            )
                        )
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
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Celebration Section
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(68.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(SukaOrange.copy(alpha = 0.2f))
                            .alpha(glowScale)
                    )
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(SukaOrange, Color(0xFFE0802B))
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(SukaGreen),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Check,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }

                Text(
                    text = "Pesanan Berhasil!",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontFamily = LilitaOne,
                        color = SukaInk,
                        fontSize = 24.sp
                    ),
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "Pembayaran terkonfirmasi. Dapur Suka sedang menyiapkan pesanan lezatmu.",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = SukaMuted,
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    ),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
            }

            // 2. Hero Digital Pickup Pass Ticket
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(26.dp),
                color = Color.White,
                border = BorderStroke(1.dp, SukaBorder),
                shadowElevation = 6.dp
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Top Accent Gradient Bar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(6.dp)
                            .background(
                                Brush.horizontalGradient(
                                    listOf(SukaOrange, SukaBrown, SukaOrange)
                                )
                            )
                    )

                    // Ticket Upper Section
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFFF4EB),
                            border = BorderStroke(1.dp, Color(0xFFFBD9BC))
                        ) {
                            Text(
                                text = "KODE PENGAMBILAN KASIR",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = SukaBrown,
                                    fontSize = 10.sp,
                                    letterSpacing = 1.sp
                                )
                            )
                        }

                        // Big Order Number
                        Surface(
                            modifier = Modifier.padding(vertical = 4.dp),
                            shape = RoundedCornerShape(20.dp),
                            color = SukaCream,
                            border = BorderStroke(2.dp, SukaOrange.copy(alpha = 0.5f))
                        ) {
                            Text(
                                text = nomorPesanan?.toString() ?: "-",
                                modifier = Modifier.padding(horizontal = 32.dp, vertical = 12.dp),
                                style = MaterialTheme.typography.headlineLarge.copy(
                                    fontFamily = LilitaOne,
                                    color = SukaBrown,
                                    fontSize = ukuranNomor(nomorPesanan),
                                    letterSpacing = 2.sp
                                ),
                                textAlign = TextAlign.Center
                            )
                        }

                        Text(
                            text = "Sebutkan nomor ini di kasir saat mengambil pesanan.",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = SukaMuted,
                                fontSize = 12.sp
                            ),
                            textAlign = TextAlign.Center
                        )
                    }

                    // Perforated Divider
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .height(1.dp)
                            .background(Color(0xFFE5E7EB))
                    )

                    // Ticket Lower Section (Metadata)
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFFAFAFA))
                            .padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Outlet Pengambilan",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 11.sp
                                )
                            )
                            Text(
                                text = namaOutlet ?: "Suka Shawarma",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = SukaInk,
                                    fontSize = 12.sp
                                )
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Estimasi Siap",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 11.sp
                                )
                            )
                            Text(
                                text = "15–20 Menit",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SukaBrown,
                                    fontSize = 12.sp
                                )
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Metode Ambil",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = SukaMuted,
                                    fontSize = 11.sp
                                )
                            )
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFFECFDF5)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(SukaGreen)
                                    )
                                    Text(
                                        text = "Ambil Mandiri (Self-Pickup)",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = SukaGreen,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Quick Helpful Tips Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                color = Color(0xFFFFF3E8),
                border = BorderStroke(1.dp, SukaOrange.copy(alpha = 0.35f))
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Filled.Storefront,
                        contentDescription = null,
                        tint = SukaOrange,
                        modifier = Modifier.size(20.dp)
                    )
                    Column {
                        Text(
                            text = "Tips Pengambilan di Outlet:",
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = SukaBrown,
                                fontSize = 12.sp
                            )
                        )
                        Text(
                            text = "Kamu bisa langsung menuju counter khusus Online Pickup tanpa perlu ikut antrean kasir.",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = SukaInk,
                                fontSize = 11.sp,
                                lineHeight = 15.sp
                            ),
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Ukuran font nomor pesanan, menyusut mengikuti panjangnya.
 */
private fun ukuranNomor(nomor: Int?): TextUnit = when ((nomor?.toString()?.length ?: 1)) {
    in 0..4 -> 54.sp
    5 -> 44.sp
    6 -> 36.sp
    else -> 28.sp
}
